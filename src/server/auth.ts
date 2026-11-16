import { timingSafeEqual } from "node:crypto";
import { getIdentity } from "../../cursor/identity.js";
import { sql, withTransaction, type Query, type Row } from "./db";
import { HttpError, boolOf, nid, textOf } from "./http";

const CATEGORIES = ["신규공급사", "리오더", "3PL", "상품 운영", "시스템 개선", "기타"];

export type Realm = "production" | "preview";
export type Role = "admin" | "manager" | "member" | "viewer" | "bot";

export type Member = {
  id: string;
  realm: Realm;
  sub: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
};

export type Viewer = {
  verified: boolean;
  kind?: string;
  sub?: string;
  email?: string;
  name?: string;
  stage?: string;
  simulated?: boolean;
  reason?: string;
};

export type Identify = (request: Request) => Promise<Viewer>;

export type Actor =
  | { type: "member"; member: Member; simulated: boolean }
  | { type: "bot"; member: Member }
  | { type: "scheduler"; realm: Realm };

function mapMember(row: Row): Member {
  return {
    id: textOf(row.id),
    realm: textOf(row.realm) === "preview" ? "preview" : "production",
    sub: textOf(row.sub),
    email: textOf(row.email),
    name: textOf(row.name),
    role: textOf(row.role) as Role,
    active: boolOf(row.active),
  };
}

export function realmFromStage(stage: string | undefined): Realm {
  return stage === "preview" ? "preview" : "production";
}

export function serviceRealm(): Realm {
  return process.env.VERCEL_ENV === "preview" ? "preview" : "production";
}

function tokenMatches(given: string, envName: string): boolean {
  const expected = process.env[envName]?.trim() ?? "";
  if (!expected || !given) return false;
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match ? match[1] : null;
}

export async function ensureRealm(realm: Realm): Promise<void> {
  await withTransaction(async (q) => {
    await q("select pg_advisory_xact_lock($1)", [7272743]);
    const bots = await q("select id from members where realm = $1 and sub = 'bot:system'", [realm]);
    if (bots.length === 0) {
      await q(
        "insert into members (id, realm, sub, email, name, role, active) values ($1, $2, 'bot:system', '', '물류 봇', 'bot', true)",
        [nid(), realm],
      );
    }
    const categories = await q("select id from categories where realm = $1 limit 1", [realm]);
    if (categories.length === 0) {
      for (let index = 0; index < CATEGORIES.length; index += 1) {
        await q("insert into categories (id, realm, name, sort_order) values ($1, $2, $3, $4)", [
          nid(),
          realm,
          CATEGORIES[index],
          index,
        ]);
      }
    }
    const settings = await q("select realm from bot_settings where realm = $1", [realm]);
    if (settings.length === 0) {
      await q("insert into bot_settings (realm) values ($1)", [realm]);
    }
  });
}

export async function botMember(realm: Realm): Promise<Member> {
  await ensureRealm(realm);
  const rows = await sql("select * from members where realm = $1 and sub = 'bot:system'", [realm]);
  if (!rows[0]) throw new HttpError(500, "bot_missing", "봇 계정을 준비하지 못했습니다.");
  return mapMember(rows[0]);
}

async function touchMember(member: Member, email: string, name: string): Promise<Member> {
  const nextName = name || member.name;
  if (member.email === email && member.name === nextName) return member;
  await sql("update members set email = $1, name = $2, updated_at = now() where id = $3", [email, nextName, member.id]);
  return { ...member, email, name: nextName };
}

export async function admitPerson(realm: Realm, viewer: Viewer): Promise<Member> {
  await ensureRealm(realm);
  if (viewer.kind !== "person" || !viewer.sub) {
    throw new HttpError(403, "not_member", "자동화 키는 팀원이 아닙니다. 사람 계정으로 들어온 뒤 초대를 받아야 합니다.");
  }
  const sub = viewer.sub;
  const email = viewer.email ?? "";
  const name = viewer.name ?? "";
  const existing = await sql("select * from members where realm = $1 and sub = $2", [realm, sub]);
  if (existing[0]) {
    const member = mapMember(existing[0]);
    if (!member.active) throw new HttpError(403, "inactive", "비활성화된 계정입니다. 관리자에게 다시 활성화를 요청하세요.");
    if (member.role === "bot") throw new HttpError(403, "not_member", "이 신원은 봇 계정입니다.");
    return touchMember(member, email, name);
  }
  return withTransaction(async (q) => admitLocked(q, realm, sub, email, name));
}

async function admitLocked(q: Query, realm: Realm, sub: string, email: string, name: string): Promise<Member> {
  await q("select pg_advisory_xact_lock($1)", [7272743]);
  const again = await q("select * from members where realm = $1 and sub = $2", [realm, sub]);
  if (again[0]) {
    const member = mapMember(again[0]);
    if (!member.active) throw new HttpError(403, "inactive", "비활성화된 계정입니다. 관리자에게 다시 활성화를 요청하세요.");
    return member;
  }
  const counts = await q<{ n: number }>("select count(*)::int as n from members where realm = $1 and role <> 'bot'", [realm]);
  if (Number(counts[0]?.n ?? 0) === 0) {
    const id = nid();
    const display = name || "관리자";
    await q(
      "insert into members (id, realm, sub, email, name, role, active) values ($1, $2, $3, $4, $5, 'admin', true)",
      [id, realm, sub, email, display],
    );
    return { id, realm, sub, email, name: display, role: "admin", active: true };
  }
  const invites = await q(
    `select * from invites
     where realm = $1 and revoked_at is null and accepted_at is null
       and ((email <> '' and lower(email) = lower($2)) or ($3 <> '' and sub = $3))
     order by created_at desc
     limit 1`,
    [realm, email, sub],
  );
  const invite = invites[0];
  if (!invite) {
    throw new HttpError(403, "not_member", "팀 작업에 접근할 수 없습니다. 관리자에게 초대를 요청하세요.");
  }
  const id = nid();
  const display = name || email || "팀원";
  const role = textOf(invite.role) as Role;
  await q(
    "insert into members (id, realm, sub, email, name, role, active) values ($1, $2, $3, $4, $5, $6, true)",
    [id, realm, sub, email, display, role],
  );
  await q("update invites set accepted_at = now() where id = $1", [textOf(invite.id)]);
  return { id, realm, sub, email, name: display, role, active: true };
}

const defaultIdentify: Identify = async (request) => (await getIdentity(request)) as Viewer;

export async function resolveActor(request: Request, identify: Identify = defaultIdentify): Promise<Actor> {
  const token = bearer(request);
  if (token) {
    const botReady = Boolean(process.env.BOT_API_TOKEN?.trim());
    const schedulerReady = Boolean(process.env.SCHEDULER_TOKEN?.trim());
    if (!botReady && !schedulerReady) {
      throw new HttpError(503, "tokens_unset", "BOT_API_TOKEN과 SCHEDULER_TOKEN이 서버에 아직 없습니다.");
    }
    if (tokenMatches(token, "BOT_API_TOKEN")) {
      const realm = serviceRealm();
      return { type: "bot", member: await botMember(realm) };
    }
    if (tokenMatches(token, "SCHEDULER_TOKEN")) {
      return { type: "scheduler", realm: serviceRealm() };
    }
    throw new HttpError(401, "bad_token", "토큰이 올바르지 않습니다.");
  }
  const viewer = await identify(request);
  if (!viewer.verified || !viewer.sub) {
    throw new HttpError(401, viewer.reason || "unauthorized", "로그인이 필요합니다. 이 앱은 Cursor에 로그인한 사람만 열 수 있습니다.");
  }
  const realm = realmFromStage(viewer.stage);
  const member = await admitPerson(realm, viewer);
  return { type: "member", member, simulated: viewer.simulated === true };
}

export function requireMember(actor: Actor): { member: Member; simulated: boolean } {
  if (actor.type === "bot") {
    throw new HttpError(403, "bot_forbidden", "봇은 담당자 변경, 기한 변경, 완료, 삭제를 할 수 없습니다.");
  }
  if (actor.type === "scheduler") {
    throw new HttpError(403, "forbidden", "예약 실행 권한으로는 이 작업을 할 수 없습니다.");
  }
  return actor;
}

export function requireRole(actor: Actor, roles: Role[]): Member {
  const { member } = requireMember(actor);
  if (!roles.includes(member.role)) {
    throw new HttpError(403, "forbidden", "이 작업을 할 권한이 없습니다.");
  }
  return member;
}

export async function loadSettings(realm: Realm): Promise<Row> {
  await ensureRealm(realm);
  const rows = await sql("select * from bot_settings where realm = $1", [realm]);
  if (!rows[0]) throw new HttpError(500, "settings_missing", "봇 설정을 준비하지 못했습니다.");
  return rows[0];
}
