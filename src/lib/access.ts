import { timingSafeEqual } from "node:crypto";
import { getIdentity } from "../../cursor/identity.js";
import { sql, withTransaction, type QueryFn } from "./db";
import { asBool, asDate, asJson, id } from "./format";
import { HttpError, isId, isUniqueViolation } from "./http";

export type Stage = "production" | "preview";
export type Role = "admin" | "manager" | "member" | "viewer" | "bot";
export type Actor = {
  memberId: string;
  role: Role;
  name: string;
  email: string;
  stage: Stage;
  kind: "human" | "bot";
};

type MemberRow = {
  id: string;
  stage: string;
  subject: string;
  email: string;
  email_norm: string;
  name: string;
  role: Role;
  active: boolean;
};

const HUMAN_ROLES = new Set(["admin", "manager", "member", "viewer"]);

export type BotSettings = {
  summaryTime: string;
  summaryWeekdays: number[];
  dueSoonBusinessDays: number;
  staleBusinessDays: number;
  overdueAlerts: boolean;
  weeklyWeekday: number;
  weeklyTime: string;
  categoryIds: string[];
};

export type NotificationSettings = {
  inApp: boolean;
  dueSoon: boolean;
  overdue: boolean;
  stale: boolean;
  mentions: boolean;
};

export type AppSettings = {
  excludeHolidays: boolean;
  revision: number;
  bot: BotSettings;
  notifications: NotificationSettings;
};

const DEFAULT_BOT: BotSettings = {
  summaryTime: "09:00",
  summaryWeekdays: [1, 2, 3, 4, 5],
  dueSoonBusinessDays: 1,
  staleBusinessDays: 3,
  overdueAlerts: true,
  weeklyWeekday: 4,
  weeklyTime: "15:00",
  categoryIds: [],
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  inApp: true,
  dueSoon: true,
  overdue: true,
  stale: true,
  mentions: true,
};

export function testAuthAllowed(request: Request): boolean {
  if (process.env.LOGISTICS_TEST_AUTH !== "1") return false;
  if (process.env.CURSOR_APP_ID || process.env.VERCEL) return false;
  try {
    const host = new URL(request.url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

export function hasAppToken(request: Request): boolean {
  const value = request.headers.get("x-cursor-app-token");
  return value != null && value.trim() !== "";
}

export function secretConfigured(name: string): boolean {
  return (process.env[name]?.trim() ?? "") !== "";
}

export function matchesSecret(headerValue: string | null, envName: string): boolean {
  const expected = process.env[envName]?.trim() ?? "";
  if (expected === "" || headerValue == null || headerValue.trim() === "") return false;
  const actual = Buffer.from(headerValue);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length) return false;
  return timingSafeEqual(actual, wanted);
}

function stageFrom(identityStage: unknown): Stage {
  if (identityStage === "preview" || process.env.VERCEL_ENV === "preview") return "preview";
  return "production";
}

type LooseIdentity = {
  verified: boolean;
  reason?: string;
  sub?: string;
  email?: string;
  name?: string;
  kind?: string;
  stage?: string;
};

async function viewer(request: Request): Promise<LooseIdentity> {
  if (testAuthAllowed(request)) {
    const raw = request.headers.get("x-logistics-test-actor");
    if (raw) {
      try {
        const parsed = JSON.parse(decodeURIComponent(raw)) as {
          sub?: string;
          email?: string;
          name?: string;
          kind?: string;
        };
        if (!parsed.sub || !/^[A-Za-z0-9:_-]{1,80}$/.test(parsed.sub)) {
          throw new HttpError(401, "unauthorized", "테스트 신원 형식이 올바르지 않습니다.");
        }
        return {
          verified: true,
          sub: parsed.sub,
          email: parsed.email ?? "",
          name: parsed.name ?? "",
          kind: parsed.kind === "key" ? "key" : "person",
          stage: "production",
        };
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(401, "unauthorized", "로그인이 필요합니다.");
      }
    }
  }
  return (await getIdentity(request)) as LooseIdentity;
}

export async function requestStage(request: Request): Promise<Stage> {
  const identity = await viewer(request);
  if (!identity.verified) return stageFrom(undefined);
  return stageFrom(identity.stage);
}

function toActor(row: MemberRow, kind: "human" | "bot"): Actor {
  return {
    memberId: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    stage: row.stage === "preview" ? "preview" : "production",
    kind,
  };
}

export async function botActor(stage: Stage): Promise<Actor> {
  const rows = await sql<MemberRow>(
    `select id, stage, subject, email, email_norm, name, role, active
     from members where stage = $1 and subject = 'bot:logistics'`,
    [stage],
  );
  const row = rows[0];
  if (!row) throw new HttpError(500, "bot_missing", "봇 계정을 찾지 못했습니다.");
  return toActor(row, "bot");
}

export async function resolveHuman(request: Request): Promise<Actor> {
  if (hasAppToken(request)) {
    throw new HttpError(403, "bot_forbidden", "앱 토큰으로는 사람 권한을 쓸 수 없습니다.");
  }
  const identity = await viewer(request);
  if (!identity.verified || !identity.sub) {
    throw new HttpError(401, "unauthorized", "로그인이 필요합니다.");
  }
  if (identity.kind !== "person" && identity.kind !== "key") {
    throw new HttpError(401, "unauthorized", "로그인이 필요합니다.");
  }
  const stage = stageFrom(identity.stage);
  const existing = await sql<MemberRow>(
    `select id, stage, subject, email, email_norm, name, role, active
     from members where stage = $1 and subject = $2`,
    [stage, identity.sub],
  );
  if (existing[0]) {
    if (!existing[0].active) {
      throw new HttpError(403, "inactive", "비활성화된 계정입니다. 관리자에게 문의하세요.");
    }
    if (identity.kind !== "person") {
      throw new HttpError(403, "bot_forbidden", "자동화 키에는 사람 권한이 없습니다. 봇 API는 별도의 토큰으로만 동작합니다.");
    }
    const name = identity.name?.trim() || existing[0].name;
    const email = identity.email?.trim() || existing[0].email;
    if (name !== existing[0].name || email !== existing[0].email) {
      await sql(
        `update members set name = $3, email = $4, email_norm = $5, updated_at = now()
         where id = $1 and stage = $2`,
        [existing[0].id, stage, name, email, email.toLowerCase()],
      );
      existing[0].name = name;
      existing[0].email = email;
    }
    return toActor(existing[0], "human");
  }
  if (identity.kind !== "person") {
    throw new HttpError(403, "bot_forbidden", "자동화 키에는 사람 권한이 없습니다. 봇 API는 별도의 토큰으로만 동작합니다.");
  }
  const created = await withTransaction((query) => provision(query, stage, identity));
  if (!created) {
    throw new HttpError(403, "forbidden", "초대된 멤버만 업무를 볼 수 있습니다.");
  }
  return toActor(created, "human");
}

async function provision(
  query: QueryFn,
  stage: Stage,
  identity: LooseIdentity,
): Promise<MemberRow | null> {
  await query(`select pg_advisory_xact_lock($1)`, [stage === "preview" ? 727274112 : 727274111]);
  const again = await query<MemberRow>(
    `select id, stage, subject, email, email_norm, name, role, active
     from members where stage = $1 and subject = $2`,
    [stage, identity.sub],
  );
  if (again[0]) return again[0].active ? again[0] : null;
  const email = identity.email?.trim() ?? "";
  const emailNorm = email.toLowerCase();
  const name = identity.name?.trim() || email || "이름 없음";
  const admins = await query<{ id: string }>(
    `select id from members where stage = $1 and role = 'admin' and active = true`,
    [stage],
  );
  if (admins.length === 0) {
    const memberId = id();
    await query(
      `insert into members (id, stage, subject, email, email_norm, name, role)
       values ($1, $2, $3, $4, $5, $6, 'admin')`,
      [memberId, stage, identity.sub, email, emailNorm, name],
    );
    return {
      id: memberId,
      stage,
      subject: identity.sub ?? "",
      email,
      email_norm: emailNorm,
      name,
      role: "admin",
      active: true,
    };
  }
  if (emailNorm === "") return null;
  const invites = await query<{ id: string; role: Role }>(
    `select id, role from invites
     where stage = $1 and email_norm = $2 and accepted_at is null
     order by created_at asc limit 1`,
    [stage, emailNorm],
  );
  const invite = invites[0];
  if (!invite || !HUMAN_ROLES.has(invite.role)) return null;
  const memberId = id();
  try {
    await query(
      `insert into members (id, stage, subject, email, email_norm, name, role)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [memberId, stage, identity.sub, email, emailNorm, name, invite.role],
    );
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await query<MemberRow>(
      `select id, stage, subject, email, email_norm, name, role, active
       from members where stage = $1 and subject = $2`,
      [stage, identity.sub],
    );
    return raced[0]?.active ? raced[0] : null;
  }
  await query(`update invites set accepted_at = now(), created_by = coalesce(created_by, created_by) where id = $1`, [
    invite.id,
  ]);
  await query(`update invites set accepted_at = now() where id = $1`, [invite.id]);
  return {
    id: memberId,
    stage,
    subject: identity.sub ?? "",
    email,
    email_norm: emailNorm,
    name,
    role: invite.role,
    active: true,
  };
}

export function assertAdmin(actor: Actor): void {
  if (actor.kind !== "human" || actor.role !== "admin") {
    throw new HttpError(403, "forbidden", "관리자만 이 작업을 할 수 있습니다.");
  }
}

export function assertProjectManager(actor: Actor): void {
  if (actor.kind !== "human" || (actor.role !== "admin" && actor.role !== "manager")) {
    throw new HttpError(403, "forbidden", "매니저 또는 관리자만 프로젝트를 바꿀 수 있습니다.");
  }
}

export async function loadSettings(stage: string, query: QueryFn = sql): Promise<AppSettings> {
  const rows = await query<{ key: string; value: unknown }>(
    `select key, value from settings where stage = $1`,
    [stage],
  );
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const bot = { ...DEFAULT_BOT, ...asJson<Partial<BotSettings>>(map.get("bot"), {}) };
  const notifications = {
    ...DEFAULT_NOTIFICATIONS,
    ...asJson<Partial<NotificationSettings>>(map.get("notifications"), {}),
  };
  const meta = asJson<{ revision?: number }>(map.get("meta"), { revision: 1 });
  return {
    excludeHolidays: asBool(map.get("exclude_holidays"), false),
    revision: Number(meta.revision ?? 1),
    bot: {
      ...bot,
      summaryWeekdays: Array.isArray(bot.summaryWeekdays) ? bot.summaryWeekdays.map(Number) : DEFAULT_BOT.summaryWeekdays,
      categoryIds: Array.isArray(bot.categoryIds) ? bot.categoryIds.map(String) : [],
      dueSoonBusinessDays: Number(bot.dueSoonBusinessDays ?? 1),
      staleBusinessDays: Number(bot.staleBusinessDays ?? 3),
      overdueAlerts: bot.overdueAlerts !== false,
      weeklyWeekday: Number(bot.weeklyWeekday ?? 4),
    },
    notifications: {
      inApp: notifications.inApp !== false,
      dueSoon: notifications.dueSoon !== false,
      overdue: notifications.overdue !== false,
      stale: notifications.stale !== false,
      mentions: notifications.mentions !== false,
    },
  };
}

export async function loadHolidays(stage: string, query: QueryFn = sql): Promise<Set<string>> {
  const rows = await query<{ day: unknown; name: string }>(
    `select day, name from holidays where stage = $1 order by day`,
    [stage],
  );
  return new Set(rows.map((row) => asDate(row.day)).filter((day): day is string => Boolean(day)));
}

export async function listHolidayRows(stage: string): Promise<{ day: string; name: string }[]> {
  const rows = await sql<{ day: unknown; name: string }>(
    `select day, name from holidays where stage = $1 order by day`,
    [stage],
  );
  return rows.flatMap((row) => {
    const day = asDate(row.day);
    return day ? [{ day, name: row.name }] : [];
  });
}

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function saveSettings(actor: Actor, body: Record<string, unknown>): Promise<AppSettings> {
  assertAdmin(actor);
  const current = await loadSettings(actor.stage);
  const revision = body.revision;
  if (revision !== current.revision) {
    throw new HttpError(409, "conflict", "다른 관리자가 설정을 먼저 저장했습니다. 다시 불러오세요.", {
      settings: current,
    });
  }
  const excludeHolidays = body.excludeHolidays === true;
  const botBody = (body.bot ?? {}) as Record<string, unknown>;
  const noteBody = (body.notifications ?? {}) as Record<string, unknown>;
  const summaryTime = typeof botBody.summaryTime === "string" && CLOCK.test(botBody.summaryTime) ? botBody.summaryTime : current.bot.summaryTime;
  const weeklyTime = typeof botBody.weeklyTime === "string" && CLOCK.test(botBody.weeklyTime) ? botBody.weeklyTime : current.bot.weeklyTime;
  const summaryWeekdays = Array.isArray(botBody.summaryWeekdays)
    ? botBody.summaryWeekdays.map(Number).filter((day) => day >= 1 && day <= 5)
    : current.bot.summaryWeekdays;
  if (summaryWeekdays.length === 0) {
    throw new HttpError(400, "invalid", "평일 요약 요일을 하루 이상 선택하세요.");
  }
  const weeklyWeekday = Number(botBody.weeklyWeekday ?? current.bot.weeklyWeekday);
  if (![1, 2, 3, 4, 5].includes(weeklyWeekday)) {
    throw new HttpError(400, "invalid", "주간 보고서 요일은 월–금 중 하나여야 합니다.");
  }
  const dueSoonBusinessDays = Number(botBody.dueSoonBusinessDays ?? current.bot.dueSoonBusinessDays);
  const staleBusinessDays = Number(botBody.staleBusinessDays ?? current.bot.staleBusinessDays);
  if (!Number.isInteger(dueSoonBusinessDays) || dueSoonBusinessDays < 0 || dueSoonBusinessDays > 14) {
    throw new HttpError(400, "invalid", "마감 전 알림 영업일 수가 올바르지 않습니다.");
  }
  if (!Number.isInteger(staleBusinessDays) || staleBusinessDays < 1 || staleBusinessDays > 30) {
    throw new HttpError(400, "invalid", "미갱신 기준 영업일 수가 올바르지 않습니다.");
  }
  const known = await sql<{ id: string }>(`select id from categories where stage = $1`, [actor.stage]);
  const knownIds = new Set(known.map((row) => row.id));
  const categoryIds = Array.isArray(botBody.categoryIds)
    ? botBody.categoryIds.map(String).filter((item) => knownIds.has(item))
    : current.bot.categoryIds;
  const holidays = Array.isArray(body.holidays) ? body.holidays.slice(0, 100) : [];
  const holidayRows: { day: string; name: string }[] = [];
  for (const item of holidays) {
    if (!item || typeof item !== "object") continue;
    const day = String((item as { day?: unknown }).day ?? "");
    const name = String((item as { name?: unknown }).name ?? "").trim().slice(0, 40);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || name === "") {
      throw new HttpError(400, "invalid", "공휴일 날짜와 이름을 확인하세요.");
    }
    holidayRows.push({ day, name });
  }
  const bot = {
    summaryTime,
    summaryWeekdays,
    dueSoonBusinessDays,
    staleBusinessDays,
    overdueAlerts: botBody.overdueAlerts !== false,
    weeklyWeekday,
    weeklyTime,
    categoryIds,
  };
  const notifications = {
    inApp: true,
    dueSoon: noteBody.dueSoon !== false,
    overdue: noteBody.overdue !== false,
    stale: noteBody.stale !== false,
    mentions: noteBody.mentions !== false,
  };
  await withTransaction(async (query) => {
    await query(
      `insert into settings (stage, key, value) values ($1, 'exclude_holidays', $2::jsonb)
       on conflict (stage, key) do update set value = excluded.value`,
      [actor.stage, JSON.stringify(excludeHolidays)],
    );
    await query(
      `insert into settings (stage, key, value) values ($1, 'bot', $2::jsonb)
       on conflict (stage, key) do update set value = excluded.value`,
      [actor.stage, JSON.stringify(bot)],
    );
    await query(
      `insert into settings (stage, key, value) values ($1, 'notifications', $2::jsonb)
       on conflict (stage, key) do update set value = excluded.value`,
      [actor.stage, JSON.stringify(notifications)],
    );
    await query(
      `insert into settings (stage, key, value) values ($1, 'meta', $2::jsonb)
       on conflict (stage, key) do update set value = excluded.value`,
      [actor.stage, JSON.stringify({ revision: current.revision + 1 })],
    );
    await query(`delete from holidays where stage = $1`, [actor.stage]);
    for (const holiday of holidayRows) {
      await query(
        `insert into holidays (stage, day, name) values ($1, $2::date, $3)`,
        [actor.stage, holiday.day, holiday.name],
      );
    }
  });
  return loadSettings(actor.stage);
}

export async function listPeople(stage: string): Promise<{ id: string; name: string; email: string; role: Role; active: boolean }[]> {
  return sql(
    `select id, name, email, role, active from members
     where stage = $1 and role <> 'bot'
     order by active desc, name asc`,
    [stage],
  );
}

export async function createInvite(actor: Actor, body: Record<string, unknown>): Promise<{ id: string; email: string; role: Role }> {
  assertAdmin(actor);
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role = typeof body.role === "string" ? body.role : "";
  if (!EMAIL.test(email) || email.length > 200) {
    throw new HttpError(400, "invalid", "초대 이메일을 확인하세요.");
  }
  if (!HUMAN_ROLES.has(role)) {
    throw new HttpError(400, "invalid", "역할은 관리자, 매니저, 멤버, 뷰어 중 하나여야 합니다.");
  }
  const emailNorm = email.toLowerCase();
  const existing = await sql<{ id: string }>(
    `select id from members where stage = $1 and email_norm = $2 and active = true`,
    [actor.stage, emailNorm],
  );
  if (existing[0]) throw new HttpError(409, "conflict", "이미 멤버인 이메일입니다.");
  const inviteId = id();
  try {
    await sql(
      `insert into invites (id, stage, email, email_norm, role, created_by)
       values ($1, $2, $3, $4, $5, $6)`,
      [inviteId, actor.stage, email, emailNorm, role, actor.memberId],
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, "conflict", "이미 초대한 이메일입니다.");
    throw error;
  }
  return { id: inviteId, email, role: role as Role };
}

export async function updateMember(actor: Actor, memberId: string, body: Record<string, unknown>): Promise<void> {
  assertAdmin(actor);
  if (!isId(memberId)) throw new HttpError(400, "invalid", "멤버를 찾지 못했습니다.");
  const rows = await sql<MemberRow>(
    `select id, stage, subject, email, email_norm, name, role, active
     from members where id = $1 and stage = $2`,
    [memberId, actor.stage],
  );
  const member = rows[0];
  if (!member || member.role === "bot") throw new HttpError(404, "not_found", "멤버를 찾지 못했습니다.");
  const role = typeof body.role === "string" ? body.role : member.role;
  const active = typeof body.active === "boolean" ? body.active : member.active;
  if (!HUMAN_ROLES.has(role)) throw new HttpError(400, "invalid", "역할이 올바르지 않습니다.");
  if (member.id === actor.memberId && !active) {
    throw new HttpError(400, "invalid", "자신의 계정은 비활성화할 수 없습니다.");
  }
  const removingAdmin = member.role === "admin" && member.active && (role !== "admin" || !active);
  if (removingAdmin) {
    const admins = await sql<{ n: number }>(
      `select count(*)::int as n from members where stage = $1 and role = 'admin' and active = true and id <> $2`,
      [actor.stage, member.id],
    );
    if (Number(admins[0]?.n ?? 0) < 1) {
      throw new HttpError(400, "invalid", "마지막 관리자의 권한은 내릴 수 없습니다.");
    }
  }
  await sql(
    `update members
     set role = $3, active = $4, deactivated_at = case when $4 then null else now() end, updated_at = now()
     where id = $1 and stage = $2`,
    [member.id, actor.stage, role, active],
  );
}

export async function listCategories(stage: string, includeArchived: boolean) {
  return sql<{ id: string; name: string; sort_order: number; archived: boolean }>(
    `select id, name, sort_order, archived from categories
     where stage = $1 and ($2::boolean or archived = false)
     order by sort_order, name`,
    [stage, includeArchived],
  );
}

export async function createCategory(actor: Actor, body: Record<string, unknown>) {
  assertProjectManager(actor);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 40) throw new HttpError(400, "invalid", "프로젝트 이름을 확인하세요.");
  const sort = await sql<{ n: number }>(
    `select coalesce(max(sort_order), 0)::int as n from categories where stage = $1`,
    [actor.stage],
  );
  const categoryId = id();
  try {
    await sql(
      `insert into categories (id, stage, name, sort_order) values ($1, $2, $3, $4)`,
      [categoryId, actor.stage, name, Number(sort[0]?.n ?? 0) + 1],
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, "conflict", "같은 이름의 프로젝트가 있습니다.");
    throw error;
  }
  return { id: categoryId, name };
}

export async function updateCategory(actor: Actor, categoryId: string, body: Record<string, unknown>) {
  assertProjectManager(actor);
  if (!isId(categoryId)) throw new HttpError(400, "invalid", "프로젝트를 찾지 못했습니다.");
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const archived = typeof body.archived === "boolean" ? body.archived : undefined;
  if (name != null && (name.length < 1 || name.length > 40)) {
    throw new HttpError(400, "invalid", "프로젝트 이름을 확인하세요.");
  }
  try {
    const rows = await sql<{ id: string }>(
      `update categories
       set name = coalesce($3, name), archived = coalesce($4, archived)
       where id = $1 and stage = $2
       returning id`,
      [categoryId, actor.stage, name ?? null, archived ?? null],
    );
    if (!rows[0]) throw new HttpError(404, "not_found", "프로젝트를 찾지 못했습니다.");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (isUniqueViolation(error)) throw new HttpError(409, "conflict", "같은 이름의 프로젝트가 있습니다.");
    throw error;
  }
}

export async function listInvites(stage: string) {
  return sql<{ id: string; email: string; role: Role; created_at: Date; accepted_at: Date | null }>(
    `select id, email, role, created_at, accepted_at from invites
     where stage = $1 order by created_at desc limit 100`,
    [stage],
  );
}
