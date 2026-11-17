import type { Actor } from "./access";
import { loadHolidays, loadSettings } from "./access";
import type { QueryFn } from "./db";
import { sql, withTransaction } from "./db";
import { asDate, asIso, asJson, id } from "./format";
import { HttpError, isId } from "./http";
import {
  addDays,
  addMonths,
  dueInstant,
  endOfWeek,
  isValidDate,
  seoulDate,
  shiftBusinessDays,
  startOfWeek,
} from "./time";

const PRIORITIES = new Set(["긴급", "높음", "보통", "낮음"]);
const STATUSES = new Set(["할 일", "진행 중", "확인 요청", "보류", "완료"]);
const FREQS = new Set(["daily", "weekly", "monthly", "yearly"]);
export type Cadence = "once" | "daily" | "weekly" | "monthly" | "yearly";
const CADENCES = new Set<Cadence>(["once", "daily", "weekly", "monthly", "yearly"]);

export function asCadence(value: unknown): Cadence {
  return value === "daily" || value === "weekly" || value === "monthly" || value === "yearly" ? value : "once";
}

type TaskRow = {
  id: string;
  stage: string;
  title: string;
  body: string;
  category_id: string | null;
  owner_id: string;
  creator_id: string;
  start_date: unknown;
  due_date: unknown;
  due_time: string | null;
  due_at: unknown;
  priority: string;
  status: string;
  checklist: unknown;
  tags: unknown;
  links: unknown;
  hold_reason: string | null;
  delay_reason: string | null;
  version: number;
  deleted_at: unknown;
  completed_at: unknown;
  created_at: unknown;
  updated_at: unknown;
  is_template: boolean;
  template_id: string | null;
  occurrence_key: string | null;
  recurrence_freq: string | null;
  recurrence_interval: number | null;
  recurrence_business_days: boolean | null;
  recurrence_dom: number | null;
  recurrence_until: unknown;
  next_run_on: unknown;
  work_kind?: string | null;
  category_name?: string | null;
};

type Person = { id: string; name: string; email: string; role?: string; active?: boolean };
type CheckItem = { id: string; text: string; done: boolean };
type LinkItem = { url: string; label: string };

export type TaskDto = {
  id: string;
  href: string;
  title: string;
  body: string;
  categoryId: string | null;
  categoryName: string | null;
  owner: { id: string; name: string; email: string };
  collaborators: { id: string; name: string; email: string }[];
  creator: { id: string; name: string };
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  dueAt: string | null;
  priority: string;
  status: string;
  checklist: CheckItem[];
  tags: string[];
  links: LinkItem[];
  holdReason: string | null;
  delayReason: string | null;
  version: number;
  deletedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  overdue: boolean;
  recurring: boolean;
  workKind: Cadence;
  templateId: string | null;
  recurrence: {
    freq: string;
    interval: number;
    businessDaysOnly: boolean;
    until: string | null;
    nextRunOn: string | null;
    active: boolean;
  } | null;
};

function cleanText(value: unknown, max: number, label: string, required = false): string {
  if (value == null && !required) return "";
  if (typeof value !== "string") throw new HttpError(400, "invalid", `${label} 값이 올바르지 않습니다.`);
  if (value.includes("\0")) throw new HttpError(400, "invalid", `${label} 값이 올바르지 않습니다.`);
  const trimmed = value.trim();
  if (required && trimmed.length === 0) throw new HttpError(400, "invalid", `${label}을 입력하세요.`);
  if (trimmed.length > max) throw new HttpError(400, "invalid", `${label}이 너무 깁니다.`);
  return trimmed;
}

function optionalDate(value: unknown, label: string): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !isValidDate(value)) {
    throw new HttpError(400, "invalid", `${label} 날짜가 올바르지 않습니다.`);
  }
  return value;
}

function optionalTime(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new HttpError(400, "invalid", "마감 시각은 HH:MM 형식이어야 합니다.");
  }
  return value;
}

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function parseChecklist(value: unknown): CheckItem[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, "invalid", "체크리스트 형식이 올바르지 않습니다.");
  if (value.length > 50) throw new HttpError(400, "invalid", "체크리스트는 50개까지입니다.");
  return value.map((item) => {
    if (typeof item === "string") {
      const text = cleanText(item, 200, "체크리스트");
      return { id: id(), text, done: false };
    }
    if (!item || typeof item !== "object") throw new HttpError(400, "invalid", "체크리스트 형식이 올바르지 않습니다.");
    const record = item as { id?: unknown; text?: unknown; done?: unknown };
    const text = cleanText(record.text, 200, "체크리스트");
    const itemId = typeof record.id === "string" && isId(record.id) ? record.id : id();
    return { id: itemId, text, done: record.done === true };
  }).filter((item) => item.text !== "");
}

function parseTags(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, "invalid", "태그 형식이 올바르지 않습니다.");
  if (value.length > 20) throw new HttpError(400, "invalid", "태그는 20개까지입니다.");
  const tags = value.map((item) => cleanText(item, 30, "태그")).filter(Boolean);
  return [...new Set(tags)];
}

function parseLinks(value: unknown): LinkItem[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, "invalid", "링크 형식이 올바르지 않습니다.");
  if (value.length > 10) throw new HttpError(400, "invalid", "링크는 10개까지입니다.");
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new HttpError(400, "invalid", "링크 형식이 올바르지 않습니다.");
    const record = item as { url?: unknown; label?: unknown };
    const raw = typeof record.url === "string" ? record.url.trim() : "";
    const url = safeUrl(raw);
    if (!url) throw new HttpError(400, "invalid", "링크는 http 또는 https 주소만 가능합니다.");
    return { url, label: cleanText(record.label ?? "", 80, "링크 이름") };
  });
}

function person(people: Map<string, Person>, memberId: string | null): { id: string; name: string; email: string } {
  if (!memberId) return { id: "", name: "알 수 없음", email: "" };
  const found = people.get(memberId);
  if (!found) return { id: memberId, name: "알 수 없음", email: "" };
  return { id: found.id, name: found.name || found.email || "이름 없음", email: found.email };
}

export function toDto(
  row: TaskRow,
  people: Map<string, Person>,
  collaboratorIds: string[],
  now = new Date(),
  recurrence: TaskDto["recurrence"] = null,
): TaskDto {
  const dueAt = asIso(row.due_at);
  const deletedAt = asIso(row.deleted_at);
  const status = row.status;
  return {
    id: row.id,
    href: `/tasks/${row.id}`,
    title: row.title,
    body: row.body,
    categoryId: row.category_id,
    categoryName: row.category_name ?? null,
    owner: person(people, row.owner_id),
    collaborators: collaboratorIds.map((memberId) => person(people, memberId)),
    creator: { id: row.creator_id, name: person(people, row.creator_id).name },
    startDate: asDate(row.start_date),
    dueDate: asDate(row.due_date),
    dueTime: row.due_time,
    dueAt,
    priority: row.priority,
    status,
    checklist: asJson<CheckItem[]>(row.checklist, []),
    tags: asJson<string[]>(row.tags, []),
    links: asJson<LinkItem[]>(row.links, []),
    holdReason: row.hold_reason,
    delayReason: row.delay_reason,
    version: Number(row.version),
    deletedAt,
    completedAt: asIso(row.completed_at),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
    overdue: Boolean(dueAt && !deletedAt && status !== "완료" && new Date(dueAt).getTime() < now.getTime()),
    recurring: Boolean(row.template_id),
    workKind: asCadence(row.work_kind),
    templateId: row.template_id,
    recurrence,
  };
}

async function peopleByIds(stage: string, ids: string[], query: QueryFn = sql): Promise<Map<string, Person>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, Person>();
  if (unique.length === 0) return map;
  const params: unknown[] = [stage];
  const marks = unique.map((memberId) => {
    params.push(memberId);
    return `$${params.length}`;
  });
  const rows = await query<Person>(
    `select id, name, email, role, active from members where stage = $1 and id in (${marks.join(", ")})`,
    params,
  );
  for (const row of rows) map.set(row.id, row);
  return map;
}

async function collaboratorsOf(taskIds: string[], query: QueryFn = sql): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (taskIds.length === 0) return map;
  const params: unknown[] = [];
  const marks = taskIds.map((taskId) => {
    params.push(taskId);
    return `$${params.length}`;
  });
  const rows = await query<{ task_id: string; member_id: string }>(
    `select task_id, member_id from task_collaborators where task_id in (${marks.join(", ")})`,
    params,
  );
  for (const row of rows) {
    const list = map.get(row.task_id) ?? [];
    list.push(row.member_id);
    map.set(row.task_id, list);
  }
  return map;
}

async function hydrate(rows: TaskRow[], stage: string, query: QueryFn = sql, now = new Date()): Promise<TaskDto[]> {
  const collabs = await collaboratorsOf(rows.map((row) => row.id), query);
  const ids = rows.flatMap((row) => [row.owner_id, row.creator_id, ...(collabs.get(row.id) ?? [])]);
  const people = await peopleByIds(stage, ids, query);
  return rows.map((row) => toDto(row, people, collabs.get(row.id) ?? [], now));
}

function assigned(actor: Actor, row: { owner_id: string }, collaboratorIds: string[]): boolean {
  return row.owner_id === actor.memberId || collaboratorIds.includes(actor.memberId);
}

function canEdit(actor: Actor, row: { owner_id: string }, collaboratorIds: string[]): boolean {
  if (actor.kind !== "human") return false;
  if (actor.role === "admin" || actor.role === "manager") return true;
  return actor.role === "member" && assigned(actor, row, collaboratorIds);
}

function canReassign(actor: Actor, row: { owner_id: string }): boolean {
  if (actor.kind !== "human") return false;
  if (actor.role === "admin" || actor.role === "manager") return true;
  return actor.role === "member" && row.owner_id === actor.memberId;
}

function canComplete(actor: Actor, row: { owner_id: string }, collaboratorIds: string[]): boolean {
  if (actor.kind !== "human" || actor.role === "viewer" || actor.role === "bot") return false;
  if (actor.role === "admin" || actor.role === "manager") return true;
  return actor.role === "member" && assigned(actor, row, collaboratorIds);
}

function canDelete(actor: Actor, row: { owner_id: string }): boolean {
  if (actor.kind !== "human" || actor.role === "viewer" || actor.role === "bot") return false;
  if (actor.role === "admin" || actor.role === "manager") return true;
  return actor.role === "member" && row.owner_id === actor.memberId;
}

export type TaskFilters = {
  q?: string;
  assigneeId?: string;
  categoryId?: string;
  status?: string;
  priority?: string;
  due?: string;
  dueFrom?: string;
  dueTo?: string;
  mine?: boolean;
  open?: boolean;
  trash?: boolean;
  kind?: Cadence;
  sort?: "new";
  limit: number;
  offset: number;
  categoryScope?: string[] | null;
};

export async function listTasks(actor: Actor, filters: TaskFilters, now = new Date()) {
  if (actor.role === "viewer" && filters.trash) {
    throw new HttpError(403, "forbidden", "휴지통을 볼 권한이 없습니다.");
  }
  const settings = await loadSettings(actor.stage);
  const holidays = await loadHolidays(actor.stage);
  const where = ["t.stage = $1", "t.is_template = false"];
  const params: unknown[] = [actor.stage];
  const add = (sqlText: string, value?: unknown) => {
    if (value !== undefined) params.push(value);
    where.push(sqlText.replace(/\$\?/g, () => `$${params.length}`));
  };
  if (filters.trash) {
    where.push("t.deleted_at is not null");
    if (actor.role === "member") add("t.owner_id = $?", actor.memberId);
  } else {
    where.push("t.deleted_at is null");
  }
  if (filters.categoryScope && filters.categoryScope.length > 0) {
    params.push(filters.categoryScope.join(","));
    where.push(`t.category_id = any(string_to_array($${params.length}, ','))`);
  }
  if (filters.q) {
    const like = `%${filters.q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    params.push(like);
    where.push(`(t.title ilike $${params.length} escape '\\' or t.body ilike $${params.length} escape '\\')`);
  }
  if (filters.assigneeId) add("t.owner_id = $?", filters.assigneeId);
  if (filters.categoryId) add("t.category_id = $?", filters.categoryId);
  if (filters.status) add("t.status = $?", filters.status);
  if (filters.priority) add("t.priority = $?", filters.priority);
  if (filters.open) where.push("t.status <> '완료'");
  if (filters.mine) {
    params.push(actor.memberId);
    const mark = `$${params.length}`;
    where.push(`(t.owner_id = ${mark} or exists (select 1 from task_collaborators c where c.task_id = t.id and c.member_id = ${mark}))`);
  }
  const today = seoulDate(now);
  if (filters.due === "today") add("to_char(t.due_date, 'YYYY-MM-DD') = $?", today);
  if (filters.due === "week") {
    add("to_char(t.due_date, 'YYYY-MM-DD') >= $?", startOfWeek(today));
    add("to_char(t.due_date, 'YYYY-MM-DD') <= $?", endOfWeek(today));
  }
  if (filters.due === "next") {
    const nextStart = addDays(startOfWeek(today), 7);
    add("to_char(t.due_date, 'YYYY-MM-DD') >= $?", nextStart);
    add("to_char(t.due_date, 'YYYY-MM-DD') <= $?", addDays(nextStart, 6));
  }
  if (filters.due === "overdue") {
    add("t.due_at < $?::timestamptz and t.status <> '완료'", now.toISOString());
  }
  if (filters.due === "soon") {
    const dates: string[] = [];
    for (let offset = 1; offset <= 21; offset += 1) {
      const due = addDays(today, offset);
      if (shiftBusinessDays(due, -settings.bot.dueSoonBusinessDays, holidays, settings.excludeHolidays) === today) {
        dates.push(due);
      }
    }
    if (dates.length === 0) where.push("false");
    else add("to_char(t.due_date, 'YYYY-MM-DD') = any(string_to_array($?, ','))", dates.join(","));
  }
  if (filters.due === "stale") {
    const cutoff = shiftBusinessDays(today, -settings.bot.staleBusinessDays, holidays, settings.excludeHolidays);
    where.push("t.status = '진행 중'");
    add("to_char((t.updated_at at time zone 'Asia/Seoul')::date, 'YYYY-MM-DD') <= $?", cutoff);
  }
  if (filters.dueFrom) add("to_char(t.due_date, 'YYYY-MM-DD') >= $?", filters.dueFrom);
  if (filters.dueTo) add("to_char(t.due_date, 'YYYY-MM-DD') <= $?", filters.dueTo);
  if (filters.kind) add("t.work_kind = $?", filters.kind);
  const whereSql = where.join(" and ");
  const totalRows = await sql<{ n: number }>(
    `select count(*)::int as n from tasks t where ${whereSql}`,
    params,
  );
  const listParams = params.slice();
  listParams.push(filters.limit, filters.offset);
  const rows = await sql<TaskRow>(
    `select t.*, c.name as category_name
     from tasks t
     left join categories c on c.id = t.category_id
     where ${whereSql}
     order by ${filters.sort === "new"
       ? "t.created_at desc"
       : "case t.priority when '긴급' then 0 when '높음' then 1 when '보통' then 2 else 3 end, t.due_at nulls last, t.updated_at desc"}
     limit $${listParams.length - 1} offset $${listParams.length}`,
    listParams,
  );
  return {
    items: await hydrate(rows, actor.stage, sql, now),
    total: Number(totalRows[0]?.n ?? 0),
    limit: filters.limit,
    offset: filters.offset,
  };
}

async function loadRow(stage: string, taskId: string, query: QueryFn = sql): Promise<TaskRow | null> {
  const rows = await query<TaskRow>(
    `select t.*, c.name as category_name
     from tasks t
     left join categories c on c.id = t.category_id
     where t.id = $1 and t.stage = $2 and t.is_template = false`,
    [taskId, stage],
  );
  return rows[0] ?? null;
}

export async function getTask(actor: Actor, taskId: string, scope: string[] | null = null) {
  if (!isId(taskId)) throw new HttpError(404, "not_found", "업무를 찾지 못했습니다.");
  const row = await loadRow(actor.stage, taskId);
  if (!row) throw new HttpError(404, "not_found", "업무를 찾지 못했습니다.");
  if (scope && scope.length > 0 && (!row.category_id || !scope.includes(row.category_id))) {
    throw new HttpError(404, "not_found", "업무를 찾지 못했습니다.");
  }
  const collabs = await collaboratorsOf([row.id]);
  const collaboratorIds = collabs.get(row.id) ?? [];
  if (row.deleted_at && !canDelete(actor, row) && actor.role !== "admin" && actor.role !== "manager") {
    throw new HttpError(404, "not_found", "업무를 찾지 못했습니다.");
  }
  if (row.deleted_at && actor.role === "member" && row.owner_id !== actor.memberId) {
    throw new HttpError(404, "not_found", "업무를 찾지 못했습니다.");
  }
  const people = await peopleByIds(actor.stage, [row.owner_id, row.creator_id, ...collaboratorIds]);
  let recurrence: TaskDto["recurrence"] = null;
  if (row.template_id) {
    const templates = await sql<TaskRow>(`select * from tasks where id = $1 and stage = $2`, [row.template_id, actor.stage]);
    const template = templates[0];
    if (template?.recurrence_freq) {
      recurrence = {
        freq: template.recurrence_freq,
        interval: Number(template.recurrence_interval ?? 1),
        businessDaysOnly: template.recurrence_business_days !== false,
        until: asDate(template.recurrence_until),
        nextRunOn: asDate(template.next_run_on),
        active: Boolean(asDate(template.next_run_on)),
      };
    }
  }
  const dto = toDto(row, people, collaboratorIds, new Date(), recurrence);
  const comments = await sql<{
    id: string;
    body: string;
    kind: string;
    created_at: unknown;
    author_id: string;
  }>(
    `select id, body, kind, created_at, author_id from comments where task_id = $1 order by created_at asc`,
    [row.id],
  );
  const events = await sql<{
    id: string;
    action: string;
    field: string | null;
    old_value: string | null;
    new_value: string | null;
    actor_kind: string;
    actor_id: string | null;
    created_at: unknown;
  }>(
    `select id, action, field, old_value, new_value, actor_kind, actor_id, created_at
     from task_events where task_id = $1 order by created_at asc`,
    [row.id],
  );
  const extraIds = [
    ...comments.map((comment) => comment.author_id),
    ...events.map((event) => event.actor_id ?? ""),
  ];
  const morePeople = await peopleByIds(actor.stage, extraIds);
  for (const [key, value] of morePeople) people.set(key, value);
  return {
    task: dto,
    comments: comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      kind: comment.kind,
      createdAt: asIso(comment.created_at),
      author: person(people, comment.author_id),
    })),
    events: events.map((event) => ({
      id: event.id,
      action: event.action,
      field: event.field,
      oldValue: event.old_value,
      newValue: event.new_value,
      actorKind: event.actor_kind,
      actorName: person(people, event.actor_id).name,
      createdAt: asIso(event.created_at),
    })),
  };
}

async function assertMembers(stage: string, ids: string[], query: QueryFn): Promise<Person[]> {
  if (ids.length === 0) return [];
  const people = await peopleByIds(stage, ids, query);
  const rows: Person[] = [];
  for (const memberId of ids) {
    const member = people.get(memberId);
    if (!member || member.active === false || member.role === "bot") {
      throw new HttpError(400, "invalid", "담당자 또는 협업자를 확인하세요.");
    }
    rows.push(member);
  }
  return rows;
}

function nextDate(
  freq: string,
  interval: number,
  businessDaysOnly: boolean,
  dom: number,
  from: string,
  until: string | null,
  holidays: Set<string>,
  excludeHolidays: boolean,
): string | null {
  let next = from;
  if (freq === "daily" && businessDaysOnly) next = shiftBusinessDays(from, interval, holidays, excludeHolidays);
  else if (freq === "daily") next = addDays(from, interval);
  else if (freq === "weekly") next = addDays(from, 7 * interval);
  else if (freq === "monthly") next = addMonths(from, interval, dom);
  else if (freq === "yearly") next = addMonths(from, 12 * interval, dom);
  else return null;
  if (next === from) return null;
  if (until && next > until) return null;
  return next;
}

async function writeEvent(
  query: QueryFn,
  stage: string,
  taskId: string,
  actor: { memberId: string; kind: "human" | "bot" },
  action: string,
  field: string | null,
  oldValue: string | null,
  newValue: string | null,
) {
  await query(
    `insert into task_events (id, stage, task_id, actor_id, actor_kind, action, field, old_value, new_value)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id(), stage, taskId, actor.memberId, actor.kind, action, field, oldValue, newValue],
  );
}

async function notify(
  query: QueryFn,
  stage: string,
  memberId: string,
  taskId: string,
  kind: string,
  title: string,
  body: string,
  dedupe: string,
) {
  await query(
    `insert into notifications (id, stage, member_id, task_id, kind, title, body, dedupe_key)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (dedupe_key) do nothing`,
    [id(), stage, memberId, taskId, kind, title, body, dedupe],
  );
}

export async function createTask(actor: Actor, body: Record<string, unknown>, now = new Date()) {
  if (actor.kind !== "human" || actor.role === "viewer" || actor.role === "bot") {
    throw new HttpError(403, "forbidden", "업무를 만들 권한이 없습니다.");
  }
  const title = cleanText(body.title, 200, "제목", true);
  const text = cleanText(body.body ?? "", 20_000, "본문");
  const priority = typeof body.priority === "string" ? body.priority : "보통";
  const status = typeof body.status === "string" ? body.status : "할 일";
  if (!PRIORITIES.has(priority) || !STATUSES.has(status)) {
    throw new HttpError(400, "invalid", "우선순위 또는 상태가 올바르지 않습니다.");
  }
  const startDate = optionalDate(body.startDate, "시작");
  const dueDate = optionalDate(body.dueDate, "마감");
  const dueTime = optionalTime(body.dueTime);
  const holdReason = cleanText(body.holdReason ?? "", 500, "보류 사유") || null;
  const delayReason = cleanText(body.delayReason ?? "", 500, "지연 사유") || null;
  if (status === "보류" && !holdReason) throw new HttpError(400, "invalid", "보류 사유를 입력하세요.");
  const checklist = parseChecklist(body.checklist);
  const tags = parseTags(body.tags);
  const links = parseLinks(body.links);
  const ownerId = typeof body.ownerId === "string" && body.ownerId ? body.ownerId : actor.memberId;
  const collaboratorIds = Array.isArray(body.collaboratorIds) ? [...new Set(body.collaboratorIds.map(String))] : [];
  if (!isId(ownerId) || collaboratorIds.some((item) => !isId(item))) {
    throw new HttpError(400, "invalid", "담당자 또는 협업자를 확인하세요.");
  }
  const categoryId = typeof body.categoryId === "string" && body.categoryId ? body.categoryId : null;
  if (categoryId && !isId(categoryId)) throw new HttpError(400, "invalid", "프로젝트를 확인하세요.");
  if (body.workKind !== undefined && !CADENCES.has(body.workKind as Cadence)) {
    throw new HttpError(400, "invalid", "반복 구분이 올바르지 않습니다.");
  }
  const explicitKind = body.workKind === undefined ? null : asCadence(body.workKind);
  let recurrence: { freq: string; interval: number; businessDaysOnly: boolean; until: string | null } | null = null;
  if (body.recurrence && typeof body.recurrence === "object") {
    const record = body.recurrence as Record<string, unknown>;
    const freq = String(record.freq ?? "");
    const interval = Number(record.interval ?? 1);
    if (!FREQS.has(freq) || !Number.isInteger(interval) || interval < 1 || interval > 30) {
      throw new HttpError(400, "invalid", "반복 설정이 올바르지 않습니다.");
    }
    if (!dueDate) throw new HttpError(400, "invalid", "반복 업무에는 마감일이 필요합니다.");
    recurrence = {
      freq,
      interval,
      businessDaysOnly: record.businessDaysOnly !== false,
      until: optionalDate(record.until, "반복 종료"),
    };
  }
  if (!recurrence && explicitKind && explicitKind !== "once") {
    if (!dueDate) throw new HttpError(400, "invalid", "반복 업무에는 마감일이 필요합니다.");
    recurrence = {
      freq: explicitKind,
      interval: 1,
      businessDaysOnly: explicitKind === "daily",
      until: null,
    };
  }
  const workKind = explicitKind ?? asCadence(recurrence?.freq);
  const dueAt = dueInstant(dueDate, dueTime);
  const completedAt = status === "완료" ? now.toISOString() : null;
  const taskId = await withTransaction(async (query) => {
    if (categoryId) {
      const categories = await query<{ id: string }>(
        `select id from categories where id = $1 and stage = $2 and archived = false`,
        [categoryId, actor.stage],
      );
      if (!categories[0]) throw new HttpError(400, "invalid", "프로젝트를 확인하세요.");
    }
    await assertMembers(actor.stage, [ownerId, ...collaboratorIds.filter((item) => item !== ownerId)], query);
    const holidays = recurrence ? await loadHolidays(actor.stage, query) : new Set<string>();
    const settings = recurrence ? await loadSettings(actor.stage, query) : null;
    const createdId = id();
    if (!recurrence) {
      await insertTask(query, {
        id: createdId,
        stage: actor.stage,
        title,
        body: text,
        categoryId,
        ownerId,
        creatorId: actor.memberId,
        startDate,
        dueDate,
        dueTime,
        dueAt,
        priority,
        status,
        checklist,
        tags,
        links,
        holdReason,
        delayReason,
        completedAt,
        templateId: null,
        occurrenceKey: null,
        isTemplate: false,
        workKind,
      });
      await replaceCollaborators(query, createdId, collaboratorIds.filter((item) => item !== ownerId));
      await writeEvent(query, actor.stage, createdId, actor, "create", "status", null, status);
      await notifyAssignees(query, actor, createdId, ownerId, collaboratorIds, title, "1");
      return createdId;
    }
    if (!dueDate) throw new HttpError(400, "invalid", "반복 업무에는 마감일이 필요합니다.");
    const templateId = id();
    const following = nextDate(
      recurrence.freq,
      recurrence.interval,
      recurrence.businessDaysOnly,
      Number(dueDate.slice(8, 10)),
      dueDate,
      recurrence.until,
      holidays,
      settings?.excludeHolidays === true,
    );
    await query(
      `insert into tasks (
         id, stage, title, body, category_id, owner_id, creator_id, start_date, due_date, due_time, due_at,
         priority, status, checklist, tags, links, hold_reason, delay_reason, is_template,
         recurrence_freq, recurrence_interval, recurrence_business_days, recurrence_dom, recurrence_until, next_run_on, work_kind
       ) values (
         $1,$2,$3,$4,$5,$6,$7,$8::date,$9::date,$10,$11,$12,'할 일',$13::jsonb,$14::jsonb,$15::jsonb,$16,$17,true,
         $18,$19,$20,$21,$22::date,$23::date,$24
       )`,
      [
        templateId,
        actor.stage,
        title,
        text,
        categoryId,
        ownerId,
        actor.memberId,
        startDate,
        dueDate,
        dueTime,
        dueAt?.toISOString() ?? null,
        priority,
        JSON.stringify(checklist),
        JSON.stringify(tags),
        JSON.stringify(links),
        holdReason,
        delayReason,
        recurrence.freq,
        recurrence.interval,
        recurrence.businessDaysOnly,
        Number(dueDate.slice(8, 10)),
        recurrence.until,
        following,
        workKind,
      ],
    );
    await replaceCollaborators(query, templateId, collaboratorIds.filter((item) => item !== ownerId));
    await insertTask(query, {
      id: createdId,
      stage: actor.stage,
      title,
      body: text,
      categoryId,
      ownerId,
      creatorId: actor.memberId,
      startDate: dueDate,
      dueDate,
      dueTime,
      dueAt,
      priority,
      status: "할 일",
      checklist: checklist.map((item) => ({ ...item, done: false })),
      tags,
      links,
      holdReason: null,
      delayReason: null,
      completedAt: null,
      templateId,
      occurrenceKey: dueDate,
      isTemplate: false,
      workKind,
    });
    await replaceCollaborators(query, createdId, collaboratorIds.filter((item) => item !== ownerId));
    await writeEvent(query, actor.stage, createdId, actor, "create", "status", null, "할 일");
    await notifyAssignees(query, actor, createdId, ownerId, collaboratorIds, title, "1");
    return createdId;
  });
  return getTask(actor, taskId);
}

export async function createProjectPost(actor: Actor, categoryId: string, body: Record<string, unknown>, now = new Date()) {
  if (!isId(categoryId)) throw new HttpError(400, "invalid", "프로젝트를 확인하세요.");
  const raw = Array.isArray(body.assigneeIds) ? body.assigneeIds.map(String) : [];
  const assigneeIds = [...new Set(raw.filter(Boolean))];
  if (assigneeIds.length === 0) assigneeIds.push(actor.memberId);
  if (assigneeIds.length > 20) throw new HttpError(400, "invalid", "담당자는 20명까지입니다.");
  if (assigneeIds.some((item) => !isId(item))) throw new HttpError(400, "invalid", "담당자를 확인하세요.");
  return createTask(actor, {
    ...body,
    categoryId,
    ownerId: assigneeIds[0],
    collaboratorIds: assigneeIds.slice(1),
    assigneeIds: undefined,
  }, now);
}

type InsertInput = {
  id: string;
  stage: string;
  title: string;
  body: string;
  categoryId: string | null;
  ownerId: string;
  creatorId: string;
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  dueAt: Date | null;
  priority: string;
  status: string;
  checklist: CheckItem[];
  tags: string[];
  links: LinkItem[];
  holdReason: string | null;
  delayReason: string | null;
  completedAt: string | null;
  templateId: string | null;
  occurrenceKey: string | null;
  isTemplate: boolean;
  workKind: Cadence;
};

async function notifyAssignees(
  query: QueryFn,
  actor: Actor,
  taskId: string,
  ownerId: string,
  collaboratorIds: string[],
  title: string,
  version: string,
) {
  const people = [...new Set([ownerId, ...collaboratorIds])].filter((memberId) => memberId !== actor.memberId);
  for (const memberId of people) {
    await notify(query, actor.stage, memberId, taskId, "assign", "업무가 배정되었습니다", title, `assign:${taskId}:${memberId}:${version}`);
  }
}

async function insertTask(query: QueryFn, input: InsertInput): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `insert into tasks (
       id, stage, title, body, category_id, owner_id, creator_id, start_date, due_date, due_time, due_at,
       priority, status, checklist, tags, links, hold_reason, delay_reason, completed_at,
       is_template, template_id, occurrence_key, work_kind
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8::date,$9::date,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17,$18,$19,
       $20,$21,$22,$23
     )
     on conflict (stage, template_id, occurrence_key) where template_id is not null do nothing
     returning id`,
    [
      input.id,
      input.stage,
      input.title,
      input.body,
      input.categoryId,
      input.ownerId,
      input.creatorId,
      input.startDate,
      input.dueDate,
      input.dueTime,
      input.dueAt ? input.dueAt.toISOString() : null,
      input.priority,
      input.status,
      JSON.stringify(input.checklist),
      JSON.stringify(input.tags),
      JSON.stringify(input.links),
      input.holdReason,
      input.delayReason,
      input.completedAt,
      input.isTemplate,
      input.templateId,
      input.occurrenceKey,
      input.workKind,
    ],
  );
  return Boolean(rows[0]);
}

async function replaceCollaborators(query: QueryFn, taskId: string, memberIds: string[]) {
  await query(`delete from task_collaborators where task_id = $1`, [taskId]);
  for (const memberId of [...new Set(memberIds)]) {
    await query(`insert into task_collaborators (task_id, member_id) values ($1, $2)`, [taskId, memberId]);
  }
}

export async function spawnOccurrence(
  query: QueryFn,
  stage: string,
  template: TaskRow,
  dueDate: string,
  actor: { memberId: string; kind: "human" | "bot" },
): Promise<string | null> {
  const dueTime = template.due_time;
  const dueAt = dueInstant(dueDate, dueTime);
  const checklist = asJson<CheckItem[]>(template.checklist, []).map((item) => ({
    id: id(),
    text: item.text,
    done: false,
  }));
  const occurrenceId = id();
  const created = await insertTask(query, {
    id: occurrenceId,
    stage,
    title: template.title,
    body: template.body,
    categoryId: template.category_id,
    ownerId: template.owner_id,
    creatorId: template.creator_id,
    startDate: dueDate,
    dueDate,
    dueTime,
    dueAt,
    priority: template.priority,
    status: "할 일",
    checklist,
    tags: asJson<string[]>(template.tags, []),
    links: asJson<LinkItem[]>(template.links, []),
    holdReason: null,
    delayReason: null,
    completedAt: null,
    templateId: template.id,
    occurrenceKey: dueDate,
    isTemplate: false,
    workKind: template.work_kind && template.work_kind !== "once" ? asCadence(template.work_kind) : asCadence(template.recurrence_freq),
  });
  if (!created) return null;
  const collabs = await query<{ member_id: string }>(
    `select member_id from task_collaborators where task_id = $1`,
    [template.id],
  );
  await replaceCollaborators(query, occurrenceId, collabs.map((row) => row.member_id));
  await writeEvent(query, stage, occurrenceId, actor, "create", "status", null, "할 일");
  return occurrenceId;
}

export function followingDate(
  template: TaskRow,
  from: string,
  holidays: Set<string>,
  excludeHolidays: boolean,
): string | null {
  if (!template.recurrence_freq) return null;
  return nextDate(
    template.recurrence_freq,
    Number(template.recurrence_interval ?? 1),
    template.recurrence_business_days !== false,
    Number(template.recurrence_dom ?? Number(from.slice(8, 10))),
    from,
    asDate(template.recurrence_until),
    holidays,
    excludeHolidays,
  );
}

async function syncCadence(query: QueryFn, actor: Actor, row: TaskRow, workKind: Cadence, dueDate: string | null) {
  if (workKind === "once") {
    if (row.template_id) {
      await query(
        `update tasks set next_run_on = null, updated_at = now() where id = $1 and stage = $2 and is_template = true`,
        [row.template_id, actor.stage],
      );
    }
    return;
  }
  if (!dueDate) throw new HttpError(400, "invalid", "반복 업무에는 마감일이 필요합니다.");
  const holidays = await loadHolidays(actor.stage, query);
  const settings = await loadSettings(actor.stage, query);
  const following = nextDate(
    workKind,
    1,
    workKind === "daily",
    Number(dueDate.slice(8, 10)),
    dueDate,
    null,
    holidays,
    settings.excludeHolidays,
  );
  if (row.template_id) {
    await query(
      `update tasks set recurrence_freq = $3, recurrence_interval = 1, recurrence_business_days = $4,
         recurrence_dom = $5, next_run_on = $6::date, work_kind = $3, updated_at = now()
       where id = $1 and stage = $2 and is_template = true`,
      [row.template_id, actor.stage, workKind, workKind === "daily", Number(dueDate.slice(8, 10)), following],
    );
    return;
  }
  const templateId = id();
  await query(
    `insert into tasks (
       id, stage, title, body, category_id, owner_id, creator_id, due_date, due_time, due_at,
       priority, status, checklist, tags, links, is_template, work_kind,
       recurrence_freq, recurrence_interval, recurrence_business_days, recurrence_dom, next_run_on
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$11,'할 일',$12::jsonb,$13::jsonb,$14::jsonb,true,$15,
       $15,1,$16,$17,$18::date
     )`,
    [
      templateId,
      actor.stage,
      row.title,
      row.body,
      row.category_id,
      row.owner_id,
      row.creator_id,
      dueDate,
      row.due_time,
      asIso(row.due_at),
      row.priority,
      JSON.stringify(asJson(row.checklist, [])),
      JSON.stringify(asJson(row.tags, [])),
      JSON.stringify(asJson(row.links, [])),
      workKind,
      workKind === "daily",
      Number(dueDate.slice(8, 10)),
      following,
    ],
  );
  await query(
    `update tasks set template_id = $3, occurrence_key = $4 where id = $1 and stage = $2`,
    [row.id, actor.stage, templateId, dueDate],
  );
  const collabs = await query<{ member_id: string }>(
    `select member_id from task_collaborators where task_id = $1`,
    [row.id],
  );
  await replaceCollaborators(query, templateId, collabs.map((item) => item.member_id));
}

async function conflict(query: QueryFn, stage: string, taskId: string): Promise<never> {
  const current = await loadRow(stage, taskId, query);
  if (!current) throw new HttpError(404, "not_found", "업무를 찾지 못했습니다.");
  const [dto] = await hydrate([current], stage, query);
  throw new HttpError(409, "conflict", "다른 사용자가 먼저 수정했습니다. 다시 불러온 뒤 저장하세요.", {
    task: dto,
  });
}

export async function updateTask(actor: Actor, taskId: string, body: Record<string, unknown>, now = new Date()) {
  if (!isId(taskId)) throw new HttpError(404, "not_found", "업무를 찾지 못했습니다.");
  if (typeof body.version !== "number" || !Number.isInteger(body.version)) {
    throw new HttpError(400, "invalid", "version이 필요합니다.");
  }
  const version = body.version;
  await withTransaction(async (query) => {
    const row = await loadRow(actor.stage, taskId, query);
    if (!row || row.deleted_at) throw new HttpError(404, "not_found", "업무를 찾지 못했습니다.");
    const collabs = await collaboratorsOf([row.id], query);
    const collaboratorIds = collabs.get(row.id) ?? [];
    if (!canEdit(actor, row, collaboratorIds)) {
      throw new HttpError(403, "forbidden", "이 업무를 수정할 권한이 없습니다.");
    }
    if (actor.kind === "bot") throw new HttpError(403, "bot_forbidden", "봇은 업무 내용을 바꿀 수 없습니다.");
    const nextStatus = body.status == null ? row.status : String(body.status);
    const nextPriority = body.priority == null ? row.priority : String(body.priority);
    if (!STATUSES.has(nextStatus) || !PRIORITIES.has(nextPriority)) {
      throw new HttpError(400, "invalid", "우선순위 또는 상태가 올바르지 않습니다.");
    }
    if (nextStatus === "완료" && row.status !== "완료" && !canComplete(actor, row, collaboratorIds)) {
      throw new HttpError(403, "forbidden", "완료 처리할 권한이 없습니다.");
    }
    const nextOwner = body.ownerId == null ? row.owner_id : String(body.ownerId);
    if (nextOwner !== row.owner_id && !canReassign(actor, row)) {
      throw new HttpError(403, "forbidden", "담당자를 바꿀 권한이 없습니다.");
    }
    if (!isId(nextOwner)) throw new HttpError(400, "invalid", "담당자를 확인하세요.");
    const nextCollaborators = body.collaboratorIds == null
      ? collaboratorIds
      : [...new Set((body.collaboratorIds as unknown[]).map(String))];
    const sameCollaborators = [...nextCollaborators].filter((item) => item !== nextOwner).sort().join()
      === [...collaboratorIds].sort().join();
    if (!sameCollaborators && !canReassign(actor, row)) {
      throw new HttpError(403, "forbidden", "협업자를 바꿀 권한이 없습니다.");
    }
    if (nextCollaborators.some((item) => !isId(item))) throw new HttpError(400, "invalid", "협업자를 확인하세요.");
    await assertMembers(actor.stage, [nextOwner, ...nextCollaborators.filter((item) => item !== nextOwner)], query);
    const title = body.title == null ? row.title : cleanText(body.title, 200, "제목", true);
    const text = body.body == null ? row.body : cleanText(body.body, 20_000, "본문");
    const startDate = body.startDate === undefined ? asDate(row.start_date) : optionalDate(body.startDate, "시작");
    const dueDate = body.dueDate === undefined ? asDate(row.due_date) : optionalDate(body.dueDate, "마감");
    const dueTime = body.dueTime === undefined ? row.due_time : optionalTime(body.dueTime);
    const holdReason = body.holdReason === undefined ? row.hold_reason : cleanText(body.holdReason ?? "", 500, "보류 사유") || null;
    const delayReason = body.delayReason === undefined ? row.delay_reason : cleanText(body.delayReason ?? "", 500, "지연 사유") || null;
    if (nextStatus === "보류" && row.status !== "보류" && !holdReason) {
      throw new HttpError(400, "invalid", "보류 사유를 입력하세요.");
    }
    const checklist = body.checklist === undefined ? asJson<CheckItem[]>(row.checklist, []) : parseChecklist(body.checklist);
    const tags = body.tags === undefined ? asJson<string[]>(row.tags, []) : parseTags(body.tags);
    const links = body.links === undefined ? asJson<LinkItem[]>(row.links, []) : parseLinks(body.links);
    const categoryId = body.categoryId === undefined ? row.category_id : (body.categoryId ? String(body.categoryId) : null);
    if (body.workKind !== undefined && !CADENCES.has(body.workKind as Cadence)) {
      throw new HttpError(400, "invalid", "반복 구분이 올바르지 않습니다.");
    }
    const workKind = body.workKind === undefined ? asCadence(row.work_kind) : asCadence(body.workKind);
    if (workKind !== "once" && workKind !== asCadence(row.work_kind)) {
      const anchor = body.dueDate === undefined ? asDate(row.due_date) : optionalDate(body.dueDate, "마감");
      if (!anchor) throw new HttpError(400, "invalid", "반복 업무에는 마감일이 필요합니다.");
    }
    if (categoryId && !isId(categoryId)) throw new HttpError(400, "invalid", "프로젝트를 확인하세요.");
    if (categoryId && categoryId !== row.category_id) {
      const categories = await query<{ id: string }>(
        `select id from categories where id = $1 and stage = $2 and archived = false`,
        [categoryId, actor.stage],
      );
      if (!categories[0]) throw new HttpError(400, "invalid", "프로젝트를 확인하세요.");
    }
    const dueAt = dueInstant(dueDate, dueTime);
    let completedAt = asIso(row.completed_at);
    if (nextStatus === "완료" && row.status !== "완료") completedAt = now.toISOString();
    if (nextStatus !== "완료" && row.status === "완료") completedAt = null;
    const updated = await query<TaskRow>(
      `update tasks set
         title = $4, body = $5, category_id = $6, owner_id = $7, start_date = $8::date, due_date = $9::date,
         due_time = $10, due_at = $11, priority = $12, status = $13, checklist = $14::jsonb, tags = $15::jsonb,
         links = $16::jsonb, hold_reason = $17, delay_reason = $18, completed_at = $19, work_kind = $20,
         version = version + 1, updated_at = now()
       where id = $1 and stage = $2 and version = $3 and deleted_at is null
       returning *`,
      [
        taskId,
        actor.stage,
        version,
        title,
        text,
        categoryId,
        nextOwner,
        startDate,
        dueDate,
        dueTime,
        dueAt ? dueAt.toISOString() : null,
        nextPriority,
        nextStatus,
        JSON.stringify(checklist),
        JSON.stringify(tags),
        JSON.stringify(links),
        holdReason,
        delayReason,
        completedAt,
        workKind,
      ],
    );
    if (!updated[0]) await conflict(query, actor.stage, taskId);
    if (workKind !== asCadence(row.work_kind)) {
      if (workKind !== "once" && !dueDate) throw new HttpError(400, "invalid", "반복 업무에는 마감일이 필요합니다.");
      await syncCadence(query, actor, updated[0], workKind, dueDate);
      await writeEvent(query, actor.stage, taskId, actor, "cadence", "cadence", asCadence(row.work_kind), workKind);
    }
    await replaceCollaborators(query, taskId, nextCollaborators.filter((item) => item !== nextOwner));
    if (nextStatus !== row.status) {
      await writeEvent(query, actor.stage, taskId, actor, "status", "status", row.status, nextStatus);
    }
    if (nextOwner !== row.owner_id) {
      const people = await peopleByIds(actor.stage, [row.owner_id, nextOwner], query);
      await writeEvent(
        query,
        actor.stage,
        taskId,
        actor,
        "assignee",
        "assignee",
        JSON.stringify(person(people, row.owner_id)),
        JSON.stringify(person(people, nextOwner)),
      );
      await notify(
        query,
        actor.stage,
        nextOwner,
        taskId,
        "assign",
        "담당자가 변경되었습니다",
        title,
        `assign:${taskId}:${nextOwner}:${version + 1}`,
      );
    }
    const oldDue = `${asDate(row.due_date) ?? ""} ${row.due_time ?? ""}`.trim();
    const newDue = `${dueDate ?? ""} ${dueTime ?? ""}`.trim();
    if (oldDue !== newDue) {
      await writeEvent(query, actor.stage, taskId, actor, "due", "due", oldDue || null, newDue || null);
    }
  });
  return getTask(actor, taskId);
}

export async function changeLifecycle(
  actor: Actor,
  taskId: string,
  action: "complete" | "reopen" | "trash" | "restore",
  body: Record<string, unknown>,
  now = new Date(),
) {
  if (action === "complete") {
    return updateTask(actor, taskId, { ...body, status: "완료" }, now);
  }
  if (action === "reopen") {
    return updateTask(actor, taskId, { ...body, status: "진행 중" }, now);
  }
  if (!isId(taskId)) throw new HttpError(404, "not_found", "업무를 찾지 못했습니다.");
  const version = body.version;
  if (typeof version !== "number") throw new HttpError(400, "invalid", "version이 필요합니다.");
  await withTransaction(async (query) => {
    const row = await loadRow(actor.stage, taskId, query);
    if (!row) throw new HttpError(404, "not_found", "업무를 찾지 못했습니다.");
    if (!canDelete(actor, row)) throw new HttpError(403, "forbidden", "이 업무를 휴지통으로 옮길 권한이 없습니다.");
    const deletedAt = action === "trash" ? now.toISOString() : null;
    if (action === "trash" && row.deleted_at) return;
    if (action === "restore" && !row.deleted_at) return;
    const updated = await query(
      `update tasks set deleted_at = $4, version = version + 1, updated_at = now()
       where id = $1 and stage = $2 and version = $3
       returning id`,
      [taskId, actor.stage, version, deletedAt],
    );
    if (!updated[0]) await conflict(query, actor.stage, taskId);
    await writeEvent(query, actor.stage, taskId, actor, action, "deleted", action === "trash" ? null : "trash", action);
  });
  return getTask(actor, taskId);
}

export async function stopRecurrence(actor: Actor, taskId: string) {
  const detail = await getTask(actor, taskId);
  const row = await loadRow(actor.stage, taskId);
  if (!row?.template_id) throw new HttpError(400, "invalid", "반복 업무가 아닙니다.");
  const collabs = await collaboratorsOf([row.id]);
  if (!canEdit(actor, row, collabs.get(row.id) ?? [])) {
    throw new HttpError(403, "forbidden", "반복을 중지할 권한이 없습니다.");
  }
  await sql(
    `update tasks set next_run_on = null, updated_at = now() where id = $1 and stage = $2 and is_template = true`,
    [row.template_id, actor.stage],
  );
  return detail.task.id;
}

export async function addComment(actor: Actor, taskId: string, body: Record<string, unknown>, kind = "comment") {
  if (actor.role === "viewer") {
    throw new HttpError(403, "forbidden", "댓글을 쓸 권한이 없습니다.");
  }
  if (actor.kind === "bot" && kind !== "progress_check" && kind !== "proposal") {
    throw new HttpError(403, "bot_forbidden", "봇은 진행 확인 댓글이나 제안만 남길 수 있습니다.");
  }
  if (actor.kind !== "bot" && kind !== "comment") {
    throw new HttpError(403, "forbidden", "댓글을 쓸 권한이 없습니다.");
  }
  const text = cleanText(body.body, 5000, "댓글", true);
  const commentId = await withTransaction(async (query) => {
    const row = await loadRow(actor.stage, taskId, query);
    if (!row || row.deleted_at) throw new HttpError(404, "not_found", "업무를 찾지 못했습니다.");
    const created = id();
    await query(
      `insert into comments (id, stage, task_id, author_id, body, kind) values ($1,$2,$3,$4,$5,$6)`,
      [created, actor.stage, taskId, actor.memberId, text, kind],
    );
    if (actor.kind === "human") {
      await query(`update tasks set updated_at = now() where id = $1`, [taskId]);
    }
    const collabs = await collaboratorsOf([taskId], query);
    const recipients = new Set<string>([row.owner_id, ...(collabs.get(taskId) ?? [])]);
    recipients.delete(actor.memberId);
    const mentions = new Set<string>();
    const mentioned = new Set<string>();
    for (const match of text.matchAll(/@([^\s@]{1,80})/g)) mentions.add(match[1].toLowerCase());
    if (mentions.size > 0) {
      const members = await query<Person>(
        `select id, name, email, role, active from members where stage = $1 and active = true and role <> 'bot'`,
        [actor.stage],
      );
      for (const member of members) {
        const name = member.name.toLowerCase();
        const email = member.email.toLowerCase();
        const local = email.split("@")[0] ?? "";
        if (mentions.has(name) || mentions.has(email) || (local && mentions.has(local))) {
          mentioned.add(member.id);
          if ((await loadSettings(actor.stage, query)).notifications.mentions && member.id !== actor.memberId) {
            await notify(query, actor.stage, member.id, taskId, "mention", "멘션되었습니다", text.slice(0, 140), `mention:${created}:${member.id}`);
          }
        }
      }
    }
    for (const memberId of recipients) {
      if (memberId === actor.memberId || mentioned.has(memberId)) continue;
      await notify(query, actor.stage, memberId, taskId, "comment", "새 댓글이 있습니다", text.slice(0, 140), `comment:${created}:${memberId}`);
    }
    return created;
  });
  return commentId;
}

export async function bulkUpdate(actor: Actor, body: Record<string, unknown>, now = new Date()) {
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
  if (ids.length === 0 || ids.length > 50 || ids.some((item) => !isId(item))) {
    throw new HttpError(400, "invalid", "선택한 업무를 확인하세요.");
  }
  const versions = (body.versions ?? {}) as Record<string, unknown>;
  const results: { id: string; ok: boolean; status?: number; message?: string }[] = [];
  for (const taskId of ids) {
    const version = versions[taskId];
    try {
      if (body.ownerId != null) {
        await updateTask(actor, taskId, { version, ownerId: body.ownerId }, now);
      } else if (body.status != null) {
        await updateTask(actor, taskId, { version, status: body.status, holdReason: body.holdReason }, now);
      } else {
        throw new HttpError(400, "invalid", "바꿀 상태 또는 담당자가 필요합니다.");
      }
      results.push({ id: taskId, ok: true });
    } catch (error) {
      if (error instanceof HttpError) {
        results.push({ id: taskId, ok: false, status: error.status, message: error.message });
      } else {
        throw error;
      }
    }
  }
  return { results };
}

export async function dashboard(actor: Actor, now = new Date()) {
  const today = seoulDate(now);
  const weekEnd = endOfWeek(today);
  const mine = await listTasks(actor, { mine: true, open: true, limit: 100, offset: 0 }, now);
  const review = await listTasks(actor, { status: "확인 요청", open: true, limit: 50, offset: 0 }, now);
  const counts = await sql<{ id: string; name: string; open: number; overdue: number }>(
    `select m.id, m.name,
        count(t.id) filter (where t.status <> '완료')::int as open,
        count(t.id) filter (where t.status <> '완료' and t.due_at < $2::timestamptz)::int as overdue
     from members m
     left join tasks t
       on t.owner_id = m.id and t.stage = m.stage and t.deleted_at is null and t.is_template = false
     where m.stage = $1 and m.active = true and m.role <> 'bot'
     group by m.id, m.name
     order by m.name`,
    [actor.stage, now.toISOString()],
  );
  const recent = await sql<{
    id: string;
    task_id: string;
    title: string;
    action: string;
    field: string | null;
    actor_kind: string;
    actor_id: string | null;
    created_at: unknown;
  }>(
    `select e.id, e.task_id, t.title, e.action, e.field, e.actor_kind, e.actor_id, e.created_at
     from task_events e
     join tasks t on t.id = e.task_id
     where e.stage = $1 and t.is_template = false
     order by e.created_at desc
     limit 15`,
    [actor.stage],
  );
  const people = await peopleByIds(actor.stage, recent.map((row) => row.actor_id ?? ""));
  const summary = await sql<{ period_key: string; body: string; created_at: unknown; kind: string }>(
    `select period_key, body, created_at, kind from summaries
     where stage = $1 order by created_at desc limit 1`,
    [actor.stage],
  );
  const alerts = await sql<{ id: string; task_id: string | null; kind: string; body: string; created_at: unknown; title: string | null }>(
    `select a.id, a.task_id, a.kind, a.body, a.created_at, t.title
     from alerts a
     left join tasks t on t.id = a.task_id
     where a.stage = $1
     order by a.created_at desc
     limit 10`,
    [actor.stage],
  );
  return {
    today: mine.items.filter((item) => item.dueDate === today),
    overdue: mine.items.filter((item) => item.overdue),
    week: mine.items.filter((item) => item.dueDate && item.dueDate >= startOfWeek(today) && item.dueDate <= weekEnd),
    review: review.items,
    byAssignee: counts.map((row) => ({
      id: row.id,
      name: row.name,
      open: Number(row.open),
      overdue: Number(row.overdue),
    })),
    recent: recent.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      href: `/tasks/${row.task_id}`,
      title: row.title,
      action: row.action,
      field: row.field,
      actorKind: row.actor_kind,
      actorName: person(people, row.actor_id).name,
      createdAt: asIso(row.created_at),
    })),
    summary: summary[0]
      ? { periodKey: summary[0].period_key, kind: summary[0].kind, body: summary[0].body, createdAt: asIso(summary[0].created_at) }
      : null,
    alerts: alerts.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      href: row.task_id ? `/tasks/${row.task_id}` : null,
      title: row.title,
      kind: row.kind,
      body: row.body,
      createdAt: asIso(row.created_at),
    })),
  };
}

export async function syncCursor(actor: Actor): Promise<string | null> {
  const rows = await sql<{ cursor: unknown }>(
    `select greatest(
       (select max(updated_at) from tasks where stage = $1),
       (select max(created_at) from comments where stage = $1),
       (select max(created_at) from task_events where stage = $1),
       (select max(created_at) from notifications where stage = $1 and member_id = $2)
     ) as cursor`,
    [actor.stage, actor.memberId],
  );
  return asIso(rows[0]?.cursor);
}

export async function listNotifications(actor: Actor) {
  const rows = await sql<{
    id: string;
    task_id: string | null;
    kind: string;
    title: string;
    body: string;
    read_at: unknown;
    created_at: unknown;
  }>(
    `select id, task_id, kind, title, body, read_at, created_at
     from notifications where stage = $1 and member_id = $2
     order by created_at desc limit 40`,
    [actor.stage, actor.memberId],
  );
  const unread = await sql<{ n: number }>(
    `select count(*)::int as n from notifications where stage = $1 and member_id = $2 and read_at is null`,
    [actor.stage, actor.memberId],
  );
  return {
    unread: Number(unread[0]?.n ?? 0),
    items: rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      href: row.task_id ? `/tasks/${row.task_id}` : null,
      kind: row.kind,
      title: row.title,
      body: row.body,
      readAt: asIso(row.read_at),
      createdAt: asIso(row.created_at),
    })),
  };
}

export async function markNotifications(actor: Actor, body: Record<string, unknown>) {
  if (body.all === true) {
    await sql(
      `update notifications set read_at = now() where stage = $1 and member_id = $2 and read_at is null`,
      [actor.stage, actor.memberId],
    );
    return;
  }
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(isId).slice(0, 100) : [];
  if (ids.length === 0) return;
  const params: unknown[] = [actor.stage, actor.memberId];
  const marks = ids.map((item) => {
    params.push(item);
    return `$${params.length}`;
  });
  await sql(
    `update notifications set read_at = now()
     where stage = $1 and member_id = $2 and id in (${marks.join(", ")})`,
    params,
  );
}

export async function taskSnapshot(stage: string, taskId: string) {
  const rows = await sql<{
    status: string;
    owner_id: string;
    due_date: unknown;
    due_time: string | null;
    deleted_at: unknown;
    updated_at: unknown;
    version: number;
  }>(
    `select status, owner_id, due_date, due_time, deleted_at, updated_at, version from tasks where id = $1 and stage = $2`,
    [taskId, stage],
  );
  return rows[0] ?? null;
}
