import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { FIRST_ADMIN_EMAIL, assertUsername, normalizeUsername, requestStage, type Actor, type Role, type Stage } from "./access";
import { sql } from "./db";
import { id } from "./format";
import { HttpError, isUniqueViolation, rateLimit } from "./http";
import { hashPassword, verifyPassword } from "./passwords";

const SESSION_COOKIE = "logistics_session";
const SESSION_SECONDS = 60 * 60 * 12;
const USERNAME = /^[a-z0-9._@-]{3,80}$/;
const HUMAN_ROLES = new Set(["admin", "manager", "member", "viewer"]);

type SessionMember = {
  id: string;
  stage: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  csrf_token: string;
  password_version: number;
  must_change_password: boolean;
  expires_at: Date | string;
};

export type SessionActor = Actor & { csrfToken: string; mustChangePassword: boolean };

let dummyHash: Promise<string> | undefined;

function dummy(): Promise<string> {
  dummyHash ??= hashPassword("timing-only-not-a-credential");
  return dummyHash;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim() ?? "";
  if (/^[0-9a-fA-F:.]{1,64}$/.test(first)) return first;
  return "unknown";
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`;
}

function clearCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function assertPassword(password: string, username: string): void {
  if (password.length < 10 || password.length > 200) {
    throw new HttpError(400, "invalid", "비밀번호는 10자 이상 200자 이하여야 합니다.");
  }
  if (password.toLowerCase() === username.toLowerCase()) {
    throw new HttpError(400, "invalid", "비밀번호는 사용자 이름과 달라야 합니다.");
  }
}

async function issueSession(member: { id: string; stage: string; password_version: number }): Promise<{ token: string; csrf: string }> {
  const token = randomBytes(32).toString("base64url");
  const csrf = randomBytes(32).toString("base64url");
  await sql(
    `insert into sessions (id, stage, member_id, token_hash, csrf_token, password_version, expires_at)
     values ($1, $2, $3, $4, $5, $6, now() + interval '12 hours')`,
    [id(), member.stage, member.id, tokenHash(token), csrf, member.password_version],
  );
  return { token, csrf };
}

export async function revokeMemberSessions(memberId: string): Promise<void> {
  await sql(`update sessions set revoked_at = now() where member_id = $1 and revoked_at is null`, [memberId]);
}

export async function applyInitialAdminPassword(): Promise<{ applied: boolean }> {
  const password = process.env.INITIAL_ADMIN_PASSWORD?.trim() ?? "";
  if (password.length < 10 || password.length > 200) return { applied: false };
  const rows = await sql<{ id: string; email_norm: string; username_norm: string | null; password_hash: string | null }>(
    `select id, email_norm, username_norm, password_hash
     from members
     where role = 'admin' and email_norm = $1 and password_hash is null`,
    [FIRST_ADMIN_EMAIL],
  );
  if (rows.length === 0) return { applied: false };
  const hash = await hashPassword(password);
  let applied = false;
  for (const row of rows) {
    const username = row.username_norm && row.username_norm !== "" ? row.username_norm : row.email_norm;
    const updated = await sql<{ id: string }>(
      `update members
       set password_hash = $2,
           username = coalesce(nullif(username, ''), $3),
           username_norm = coalesce(nullif(username_norm, ''), $3),
           must_change_password = true,
           password_version = password_version + 1,
           updated_at = now()
       where id = $1 and password_hash is null
       returning id`,
      [row.id, hash, username],
    );
    if (updated[0]) applied = true;
  }
  return { applied };
}

let ensureOnce: Promise<void> | undefined;

export function ensureInitialAdminPassword(): Promise<void> {
  ensureOnce ??= applyInitialAdminPassword().then(
    () => undefined,
    (error: unknown) => {
      ensureOnce = undefined;
      throw error;
    },
  );
  return ensureOnce;
}

export async function resolveSession(request: Request): Promise<SessionActor> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) throw new HttpError(401, "unauthorized", "로그인이 필요합니다.");
  const rows = await sql<SessionMember>(
    `select m.id, m.stage, m.email, m.name, m.role, m.active, s.csrf_token, s.password_version, m.must_change_password, s.expires_at
     from sessions s
     join members m on m.id = s.member_id
     where s.token_hash = $1
       and s.revoked_at is null
       and s.expires_at > now()
       and m.password_version = s.password_version
       and m.role <> 'bot'`,
    [tokenHash(token)],
  );
  const row = rows[0];
  if (!row || !row.active) throw new HttpError(401, "unauthorized", "로그인이 필요합니다.");
  const stage: Stage = row.stage === "preview" ? "preview" : "production";
  return {
    memberId: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    stage,
    kind: "human",
    csrfToken: row.csrf_token,
    mustChangePassword: row.must_change_password,
  };
}

export function assertCsrf(request: Request, actor: SessionActor): void {
  const given = request.headers.get("x-csrf-token") ?? "";
  const expected = actor.csrfToken;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length === 0 || a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(403, "csrf", "요청을 확인하지 못했습니다. 다시 로그인해 주세요.");
  }
}

export async function login(request: Request, body: Record<string, unknown>): Promise<Response> {
  const username = normalizeUsername(typeof body.username === "string" ? body.username : "");
  const password = typeof body.password === "string" ? body.password : "";
  const stage = await requestStage(request);
  const ip = clientIp(request);
  const userKey = username.slice(0, 80) || "blank";
  const userAllowed = await rateLimit(`login:user:${userKey}`, 5);
  const ipAllowed = await rateLimit(`login:ip:${ip}`, 20);
  if (!userAllowed || !ipAllowed) {
    throw new HttpError(429, "rate", "로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.");
  }
  if (!USERNAME.test(username) || password.length < 1 || password.length > 200) {
    await verifyPassword(password || "timing-only-not-a-credential", await dummy());
    throw new HttpError(401, "unauthorized", "사용자 이름 또는 비밀번호가 올바르지 않습니다.");
  }
  const rows = await sql<{
    id: string;
    stage: string;
    name: string;
    role: Role;
    active: boolean;
    password_hash: string | null;
    password_version: number;
    must_change_password: boolean;
  }>(
    `select id, stage, name, role, active, password_hash, password_version, must_change_password
     from members
     where stage = $1 and username_norm = $2 and role <> 'bot'
     limit 1`,
    [stage, username],
  );
  const row = rows[0];
  const hash = row?.password_hash ?? (await dummy());
  const matches = await verifyPassword(password, hash);
  if (!row || !row.password_hash || !matches) {
    throw new HttpError(401, "unauthorized", "사용자 이름 또는 비밀번호가 올바르지 않습니다.");
  }
  if (!row.active) throw new HttpError(403, "inactive", "비활성화된 계정입니다. 관리자에게 문의하세요.");
  const session = await issueSession(row);
  const headers = new Headers();
  headers.append("set-cookie", sessionCookie(session.token));
  return jsonResponse(
    {
      ok: true,
      mustChangePassword: row.must_change_password,
      csrfToken: session.csrf,
      me: { id: row.id, name: row.name, role: row.role },
    },
    200,
    headers,
  );
}

export async function logout(actor: SessionActor, request: Request): Promise<Response> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) {
    await sql(`update sessions set revoked_at = now() where token_hash = $1 and revoked_at is null`, [tokenHash(token)]);
  } else {
    await revokeMemberSessions(actor.memberId);
  }
  const headers = new Headers();
  headers.append("set-cookie", clearCookie());
  return jsonResponse({ ok: true }, 200, headers);
}

export async function changeOwnPassword(actor: SessionActor, body: Record<string, unknown>): Promise<Response> {
  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body.newPassword === "string" ? body.newPassword : "";
  const rows = await sql<{ username_norm: string; password_hash: string | null; password_version: number; stage: string }>(
    `select username_norm, password_hash, password_version, stage from members where id = $1`,
    [actor.memberId],
  );
  const row = rows[0];
  if (!row?.password_hash || !row.username_norm) throw new HttpError(400, "invalid", "비밀번호를 바꿀 수 없는 계정입니다.");
  assertPassword(next, row.username_norm);
  if (next === current) throw new HttpError(400, "invalid", "새 비밀번호는 지금 비밀번호와 달라야 합니다.");
  const matches = await verifyPassword(current, row.password_hash);
  if (!matches) throw new HttpError(401, "unauthorized", "지금 비밀번호가 올바르지 않습니다.");
  const hash = await hashPassword(next);
  const updated = await sql<{ password_version: number }>(
    `update members
     set password_hash = $2, must_change_password = false, password_version = password_version + 1, updated_at = now()
     where id = $1
     returning password_version`,
    [actor.memberId, hash],
  );
  await revokeMemberSessions(actor.memberId);
  const session = await issueSession({
    id: actor.memberId,
    stage: row.stage,
    password_version: updated[0].password_version,
  });
  const headers = new Headers();
  headers.append("set-cookie", sessionCookie(session.token));
  return jsonResponse({ ok: true, csrfToken: session.csrf, mustChangePassword: false }, 200, headers);
}

export async function createAccount(actor: Actor, body: Record<string, unknown>): Promise<{ id: string; username: string; role: Role }> {
  const { assertAdmin } = await import("./access");
  assertAdmin(actor);
  const username = normalizeUsername(typeof body.username === "string" ? body.username : "");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = typeof body.role === "string" ? body.role : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  assertUsername(username);
  assertPassword(password, username);
  if (name.length < 1 || name.length > 80) throw new HttpError(400, "invalid", "이름을 확인하세요.");
  if (!HUMAN_ROLES.has(role)) throw new HttpError(400, "invalid", "역할은 관리자, 매니저, 멤버, 뷰어 중 하나여야 합니다.");
  if (email !== "" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200)) {
    throw new HttpError(400, "invalid", "이메일을 확인하세요.");
  }
  const memberId = id();
  const hash = await hashPassword(password);
  try {
    await sql(
      `insert into members (
         id, stage, subject, email, email_norm, name, role, username, username_norm, password_hash, must_change_password, password_version
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, true, 1)`,
      [memberId, actor.stage, `local:${memberId}`, email, email.toLowerCase(), name, role, username, hash],
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, "conflict", "이미 있는 사용자 이름 또는 이메일입니다.");
    throw error;
  }
  return { id: memberId, username, role: role as Role };
}

export async function resetAccountPassword(actor: Actor, memberId: string, body: Record<string, unknown>): Promise<void> {
  const { assertAdmin } = await import("./access");
  assertAdmin(actor);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(memberId)) throw new HttpError(400, "invalid", "계정을 찾지 못했습니다.");
  const password = typeof body.password === "string" ? body.password : "";
  const rows = await sql<{ id: string; username_norm: string | null; role: Role }>(
    `select id, username_norm, role from members where id = $1 and stage = $2`,
    [memberId, actor.stage],
  );
  const member = rows[0];
  if (!member || member.role === "bot" || !member.username_norm) throw new HttpError(404, "not_found", "계정을 찾지 못했습니다.");
  assertPassword(password, member.username_norm);
  const hash = await hashPassword(password);
  await sql(
    `update members
     set password_hash = $2, must_change_password = true, password_version = password_version + 1, updated_at = now()
     where id = $1`,
    [member.id, hash],
  );
  await revokeMemberSessions(member.id);
}

function jsonResponse(data: unknown, status: number, headers: Headers): Response {
  headers.set("cache-control", "private, no-store");
  return Response.json(data, { status, headers });
}
