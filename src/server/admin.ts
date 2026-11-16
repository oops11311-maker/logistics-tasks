import type { HumanRole } from "../lib/labels";
import type { Member, Realm } from "./auth";
import { loadSettings } from "./auth";
import { sql, withTransaction, type Row } from "./db";
import { HttpError, boolOf, jsonOf, nid, numOf, textOf } from "./http";
import { describeSchedule } from "./reports";

const ROLES = new Set(["admin", "manager", "member", "viewer"]);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function mapSettings(row: Row, now = new Date()) {
  const excludeHolidays = boolOf(row.exclude_holidays);
  return {
    weekdaySummaryTime: textOf(row.weekday_summary_time),
    weekdaySummaryEnabled: boolOf(row.weekday_summary_enabled),
    dueSoonEnabled: boolOf(row.due_soon_enabled),
    dueSoonDays: numOf(row.due_soon_days),
    overdueEnabled: boolOf(row.overdue_enabled),
    staleEnabled: boolOf(row.stale_enabled),
    staleBusinessDays: numOf(row.stale_business_days),
    weeklyEnabled: boolOf(row.weekly_enabled),
    weeklyDow: numOf(row.weekly_dow),
    weeklyTime: textOf(row.weekly_time),
    recurrenceTime: textOf(row.recurrence_time) || "00:10",
    recurrenceEnabled: boolOf(row.recurrence_enabled),
    businessDays: jsonOf<number[]>(row.business_days, [1, 2, 3, 4, 5]),
    excludeHolidays,
    holidays: jsonOf<string[]>(row.holidays, []),
    scopeCategoryIds: row.scope_category_ids == null ? null : jsonOf<string[]>(row.scope_category_ids, []),
    notifyDueSoon: boolOf(row.notify_due_soon),
    notifyOverdue: boolOf(row.notify_overdue),
    notifyStale: boolOf(row.notify_stale),
    notifyMentions: boolOf(row.notify_mentions),
    holidayNote: excludeHolidays
      ? "휴일 제외가 켜져 있습니다. 등록한 날짜만 영업일에서 빠집니다."
      : "휴일은 영업일에서 제외하지 않습니다. 제외하려면 ‘휴일 제외’를 켜세요.",
    schedulingActive: false,
    schedule: describeSchedule(row, now),
  };
}

export async function listMembers(realm: Realm) {
  const members = await sql(
    "select id, name, email, role, active, created_at from members where realm = $1 and role <> 'bot' order by created_at",
    [realm],
  );
  const invites = await sql(
    "select id, email, role, created_at, accepted_at, revoked_at, case when sub <> '' then true else false end as has_sub from invites where realm = $1 order by created_at desc",
    [realm],
  );
  return {
    members: members.map((row) => ({
      id: textOf(row.id),
      name: textOf(row.name),
      email: textOf(row.email),
      role: textOf(row.role),
      active: boolOf(row.active),
      createdAt: textOf(row.created_at),
    })),
    invites: invites.map((row) => ({
      id: textOf(row.id),
      email: textOf(row.email),
      hasIdentity: boolOf(row.has_sub),
      role: textOf(row.role),
      createdAt: textOf(row.created_at),
      acceptedAt: textOf(row.accepted_at),
      revokedAt: textOf(row.revoked_at),
    })),
  };
}

export async function inviteMember(actor: Member, input: { email?: unknown; sub?: unknown; role?: unknown }) {
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const sub = typeof input.sub === "string" ? input.sub.trim() : "";
  const role = typeof input.role === "string" ? input.role : "member";
  if (!ROLES.has(role)) throw new HttpError(400, "bad_role", "역할은 관리자, 매니저, 멤버, 뷰어 중 하나입니다.");
  if (!email && !sub) throw new HttpError(400, "bad_request", "이메일 또는 Cursor 식별자가 필요합니다.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "bad_email", "이메일 형식이 올바르지 않습니다.");
  if (sub && (sub.length > 200 || /[\s\u0000-\u001f]/.test(sub))) {
    throw new HttpError(400, "bad_request", "식별자 형식이 올바르지 않습니다.");
  }
  const id = nid();
  await sql(
    "insert into invites (id, realm, email, sub, role, invited_by) values ($1, $2, $3, $4, $5, $6)",
    [id, actor.realm, email, sub, role, actor.id],
  );
  return { id, email, role, hasIdentity: sub !== "" };
}

export async function updateMember(actor: Member, memberId: string, input: { role?: unknown; active?: unknown }) {
  const rows = await sql("select * from members where id = $1 and realm = $2 and role <> 'bot'", [memberId, actor.realm]);
  const current = rows[0];
  if (!current) throw new HttpError(404, "not_found", "구성원을 찾을 수 없습니다.");
  let role = textOf(current.role);
  let active = boolOf(current.active);
  if (input.role !== undefined) {
    if (typeof input.role !== "string" || !ROLES.has(input.role)) throw new HttpError(400, "bad_role", "역할을 바꿀 수 없습니다.");
    role = input.role;
  }
  if (input.active !== undefined) active = input.active === true;
  if (memberId === actor.id && (!active || role !== "admin")) {
    throw new HttpError(400, "last_admin", "자신의 관리 권한을 여기서 내릴 수 없습니다.");
  }
  if (textOf(current.role) === "admin" && (role !== "admin" || !active)) {
    const admins = await sql<{ n: number }>(
      "select count(*)::int as n from members where realm = $1 and role = 'admin' and active = true and id <> $2",
      [actor.realm, memberId],
    );
    if (Number(admins[0]?.n ?? 0) === 0) throw new HttpError(400, "last_admin", "마지막 관리자는 내릴 수 없습니다.");
  }
  await sql("update members set role = $1, active = $2, updated_at = now() where id = $3", [role, active, memberId]);
  return { id: memberId, role: role as HumanRole, active };
}

export async function addCategory(realm: Realm, nameRaw: unknown) {
  const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
  if (!name || name.length > 40) throw new HttpError(400, "bad_request", "분류 이름은 1자에서 40자입니다.");
  const order = await sql<{ n: number }>("select coalesce(max(sort_order), 0)::int as n from categories where realm = $1", [realm]);
  try {
    const rows = await sql(
      "insert into categories (id, realm, name, sort_order) values ($1, $2, $3, $4) returning id, name, sort_order, active",
      [nid(), realm, name, Number(order[0]?.n ?? 0) + 1],
    );
    return { id: textOf(rows[0].id), name: textOf(rows[0].name), sortOrder: numOf(rows[0].sort_order), active: true };
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "23505") {
      throw new HttpError(409, "conflict", "같은 이름의 분류가 있습니다.");
    }
    throw error;
  }
}

export async function updateCategory(realm: Realm, id: string, input: { name?: unknown; active?: unknown; sortOrder?: unknown }) {
  const current = await sql("select * from categories where id = $1 and realm = $2", [id, realm]);
  if (!current[0]) throw new HttpError(404, "not_found", "분류를 찾을 수 없습니다.");
  const name = input.name === undefined ? textOf(current[0].name) : String(input.name).trim();
  if (!name || name.length > 40) throw new HttpError(400, "bad_request", "분류 이름은 1자에서 40자입니다.");
  const active = input.active === undefined ? boolOf(current[0].active) : input.active === true;
  const sortOrder = input.sortOrder === undefined ? numOf(current[0].sort_order) : Number(input.sortOrder);
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 1000) {
    throw new HttpError(400, "bad_request", "정렬 값이 올바르지 않습니다.");
  }
  try {
    await sql("update categories set name = $1, active = $2, sort_order = $3 where id = $4", [name, active, sortOrder, id]);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "23505") {
      throw new HttpError(409, "conflict", "같은 이름의 분류가 있습니다.");
    }
    throw error;
  }
  return { id, name, active, sortOrder };
}

const SETTING_FIELDS: Record<string, string> = {
  weekdaySummaryTime: "weekday_summary_time",
  weekdaySummaryEnabled: "weekday_summary_enabled",
  dueSoonEnabled: "due_soon_enabled",
  dueSoonDays: "due_soon_days",
  overdueEnabled: "overdue_enabled",
  staleEnabled: "stale_enabled",
  staleBusinessDays: "stale_business_days",
  weeklyEnabled: "weekly_enabled",
  weeklyDow: "weekly_dow",
  weeklyTime: "weekly_time",
  recurrenceTime: "recurrence_time",
  recurrenceEnabled: "recurrence_enabled",
  businessDays: "business_days",
  excludeHolidays: "exclude_holidays",
  holidays: "holidays",
  scopeCategoryIds: "scope_category_ids",
  notifyDueSoon: "notify_due_soon",
  notifyOverdue: "notify_overdue",
  notifyStale: "notify_stale",
  notifyMentions: "notify_mentions",
};

export async function updateSettings(realm: Realm, input: Record<string, unknown>) {
  const current = await loadSettings(realm);
  const sets: string[] = [];
  const params: unknown[] = [];
  const put = (column: string, value: unknown, cast = "") => {
    params.push(value);
    sets.push(`${column} = $${params.length}${cast}`);
  };
  for (const [key, column] of Object.entries(SETTING_FIELDS)) {
    if (input[key] === undefined) continue;
    const value = input[key];
    if (column.endsWith("_time")) {
      if (typeof value !== "string" || !TIME_RE.test(value)) throw new HttpError(400, "bad_time", "시각은 HH:MM 형식이어야 합니다.");
      put(column, value);
    } else if (column === "due_soon_days" || column === "stale_business_days") {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 1 || number > 30) throw new HttpError(400, "bad_request", "기간은 1에서 30 사이입니다.");
      put(column, number);
    } else if (column === "weekly_dow") {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 0 || number > 6) throw new HttpError(400, "bad_request", "요일 값이 올바르지 않습니다.");
      put(column, number);
    } else if (column.endsWith("_enabled") || column.startsWith("notify_") || column === "exclude_holidays") {
      put(column, value === true);
    } else if (column === "business_days") {
      if (!Array.isArray(value) || value.length === 0 || value.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
        throw new HttpError(400, "bad_request", "영업일을 하루 이상 고르세요.");
      }
      put(column, JSON.stringify([...new Set(value)]), "::jsonb");
    } else if (column === "holidays") {
      if (!Array.isArray(value) || value.some((day) => typeof day !== "string" || !DATE_RE.test(day))) {
        throw new HttpError(400, "bad_date", "휴일은 YYYY-MM-DD 목록이어야 합니다.");
      }
      put(column, JSON.stringify([...new Set(value)]), "::jsonb");
    } else if (column === "scope_category_ids") {
      if (value === null) put(column, null);
      else if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) {
        throw new HttpError(400, "bad_request", "봇 범위는 분류 목록이거나 전체(null)입니다.");
      } else put(column, JSON.stringify(value), "::jsonb");
    }
  }
  if (sets.length === 0) return mapSettings(current);
  params.push(realm);
  await sql(`update bot_settings set ${sets.join(", ")}, updated_at = now() where realm = $${params.length}`, params);
  return mapSettings(await loadSettings(realm));
}

export async function runLog(realm: Realm, now = new Date()) {
  const settings = await loadSettings(realm);
  const runs = await sql(
    "select id, job_name, slot_key, status, error, started_at, finished_at from job_runs where realm = $1 order by started_at desc limit 100",
    [realm],
  );
  return {
    schedulingActive: false,
    schedule: describeSchedule(settings, now),
    holidayNote: mapSettings(settings, now).holidayNote,
    runs: runs.map((row) => ({
      id: textOf(row.id),
      job: textOf(row.job_name),
      slotKey: textOf(row.slot_key),
      status: textOf(row.status),
      error: textOf(row.error),
      startedAt: textOf(row.started_at),
      finishedAt: textOf(row.finished_at),
    })),
  };
}

export async function exportRealm(realm: Realm) {
  const [categories, members, tasks, collaborators, comments, history, notifications, summaries, rules, settings] = await Promise.all([
    sql("select * from categories where realm = $1", [realm]),
    sql("select id, sub, email, name, role, active, created_at from members where realm = $1", [realm]),
    sql("select * from tasks where realm = $1", [realm]),
    sql(
      `select tc.task_id, tc.member_id from task_collaborators tc
       join tasks t on t.id = tc.task_id where t.realm = $1`,
      [realm],
    ),
    sql("select * from comments where realm = $1", [realm]),
    sql("select * from task_history where realm = $1", [realm]),
    sql("select * from notifications where realm = $1", [realm]),
    sql("select * from summaries where realm = $1", [realm]),
    sql("select * from recurrence_rules where realm = $1", [realm]),
    sql("select * from bot_settings where realm = $1", [realm]),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    note: "Cursor 식별자(sub)가 포함됩니다. 이 파일은 팀 밖에서 공유하지 마세요. 플랫폼 데이터베이스의 자동 백업 주기는 이 앱이 알 수 없습니다.",
    categories,
    members,
    tasks,
    collaborators,
    comments,
    history,
    notifications,
    summaries,
    recurrenceRules: rules,
    settings: settings[0] ?? null,
  };
}

export async function importRealm(realm: Realm, body: Record<string, unknown>) {
  if (body.version !== 1) throw new HttpError(400, "bad_request", "가져오기 버전은 1만 지원합니다.");
  const categories = asRows(body.categories).slice(0, 200);
  const members = asRows(body.members).slice(0, 500);
  const tasks = asRows(body.tasks).slice(0, 5000);
  return withTransaction(async (q) => {
    let inserted = 0;
    for (const category of categories) {
      const id = textOf(category.id);
      const name = textOf(category.name).slice(0, 40);
      if (!id || !name) continue;
      const rows = await q(
        `insert into categories (id, realm, name, sort_order, active)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do nothing
         returning id`,
        [id, realm, name, Number(category.sort_order ?? 0), category.active !== false],
      );
      if (rows[0]) inserted += 1;
    }
    for (const member of members) {
      const role = textOf(member.role);
      if (!ROLES.has(role) && role !== "bot") continue;
      const sub = textOf(member.sub);
      if (!sub) continue;
      const rows = await q(
        `insert into members (id, realm, sub, email, name, role, active)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (realm, sub) do nothing
         returning id`,
        [textOf(member.id) || nid(), realm, sub, textOf(member.email), textOf(member.name).slice(0, 80) || "팀원", role, member.active !== false],
      );
      if (rows[0]) inserted += 1;
    }
    for (const task of tasks) {
      const id = textOf(task.id);
      if (!id) continue;
      const rows = await q(
        `insert into tasks (
          id, realm, title, body, category_id, assignee_id, creator_id, start_date, due_date, due_time, due_at,
          priority, status, hold_reason, delay_reason, tags, related_urls, checklist, version, completed_at, created_at, updated_at
        ) select $1, $2, $3, $4, $5, (select id from members where id = $6 and realm = $2), $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18::jsonb, $19, $20, coalesce($21::timestamptz, now()), coalesce($22::timestamptz, now())
        where exists (select 1 from categories where id = $5 and realm = $2)
          and exists (select 1 from members where id = $7 and realm = $2)
          and not exists (select 1 from tasks where id = $1)
        returning id`,
        [
          id,
          realm,
          textOf(task.title).slice(0, 200) || "제목 없음",
          textOf(task.body).slice(0, 20000),
          textOf(task.category_id),
          textOf(task.assignee_id) || null,
          textOf(task.creator_id),
          textOf(task.start_date) || null,
          textOf(task.due_date) || null,
          textOf(task.due_time) || null,
          textOf(task.due_at) || null,
          textOf(task.priority) || "normal",
          textOf(task.status) || "todo",
          textOf(task.hold_reason),
          textOf(task.delay_reason),
          JSON.stringify(jsonOf(task.tags, [])),
          JSON.stringify(jsonOf(task.related_urls, [])),
          JSON.stringify(jsonOf(task.checklist, [])),
          Number(task.version ?? 1),
          textOf(task.completed_at) || null,
          textOf(task.created_at) || null,
          textOf(task.updated_at) || null,
        ],
      );
      if (rows[0]) inserted += 1;
    }
    return { inserted, skippedNote: "이미 있는 id는 덮어쓰지 않습니다. 기존 작업을 지우지 않습니다." };
  });
}

function asRows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "object" && item !== null) as Row[];
}
