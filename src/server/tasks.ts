import type { Frequency, PriorityId, StatusId } from "../lib/labels";
import { priorityLabel, statusLabel } from "../lib/labels";
import { dueInstant, seoulDate, seoulParts, weekRange } from "../lib/time";
import type { Member, Realm } from "./auth";
import { sql, withTransaction, type Query, type Row } from "./db";
import { HttpError, boolOf, jsonOf, nid, numOf, textOf, textOrNull } from "./http";

const STATUSES = new Set(["todo", "in_progress", "review", "hold", "done"]);
const PRIORITIES = new Set(["urgent", "high", "normal", "low"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type TaskDto = {
  id: string;
  title: string;
  body: string;
  categoryId: string;
  categoryName: string;
  assigneeId: string | null;
  assigneeName: string;
  creatorId: string;
  creatorName: string;
  collaboratorIds: string[];
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  dueAt: string | null;
  priority: PriorityId;
  status: StatusId;
  holdReason: string;
  delayReason: string;
  tags: string[];
  relatedUrls: { label: string; url: string }[];
  checklist: { id: string; text: string; done: boolean }[];
  version: number;
  trashedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  recurrenceRuleId: string | null;
  overdue: boolean;
};

export type CommentDto = {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  body: string;
  kind: string;
  createdAt: string;
};

export type HistoryDto = {
  id: string;
  taskId: string;
  taskTitle?: string;
  actorId: string;
  actorName: string;
  actorKind: string;
  field: string;
  oldValue: string;
  newValue: string;
  oldLabel: string;
  newLabel: string;
  createdAt: string;
};

type TaskFilters = {
  q?: string;
  assignee?: string;
  categoryId?: string;
  status?: string;
  priority?: string;
  due?: string;
  bucket?: string;
  trashed?: boolean;
  dueFrom?: string;
  dueTo?: string;
  limit: number;
  offset: number;
  scopeCategoryIds?: string[] | null;
  viewerId?: string;
};

const TASK_SELECT = `
  select t.id, t.title, t.body, t.category_id, c.name as category_name,
    t.assignee_id, coalesce(a.name, '') as assignee_name,
    t.creator_id, cr.name as creator_name,
    t.start_date, t.due_date, t.due_time, t.due_at,
    t.priority, t.status, t.hold_reason, t.delay_reason,
    t.tags, t.related_urls, t.checklist, t.version,
    t.trashed_at, t.completed_at, t.created_at, t.updated_at,
    t.recurrence_rule_id
  from tasks t
  join categories c on c.id = t.category_id
  left join members a on a.id = t.assignee_id
  join members cr on cr.id = t.creator_id
`;

export function mapTask(row: Row, collaboratorIds: string[] = [], now = new Date()): TaskDto {
  const dueAt = textOrNull(row.due_at);
  const status = textOf(row.status) as StatusId;
  const overdue = status !== "done" && dueAt !== null && new Date(dueAt).getTime() < now.getTime();
  return {
    id: textOf(row.id),
    title: textOf(row.title),
    body: textOf(row.body),
    categoryId: textOf(row.category_id),
    categoryName: textOf(row.category_name),
    assigneeId: textOrNull(row.assignee_id),
    assigneeName: textOf(row.assignee_name),
    creatorId: textOf(row.creator_id),
    creatorName: textOf(row.creator_name),
    collaboratorIds,
    startDate: textOrNull(row.start_date),
    dueDate: textOrNull(row.due_date),
    dueTime: textOrNull(row.due_time),
    dueAt,
    priority: textOf(row.priority) as PriorityId,
    status,
    holdReason: textOf(row.hold_reason),
    delayReason: textOf(row.delay_reason),
    tags: jsonOf<string[]>(row.tags, []),
    relatedUrls: jsonOf<{ label: string; url: string }[]>(row.related_urls, []),
    checklist: jsonOf<{ id: string; text: string; done: boolean }[]>(row.checklist, []),
    version: numOf(row.version),
    trashedAt: textOrNull(row.trashed_at),
    completedAt: textOrNull(row.completed_at),
    createdAt: textOf(row.created_at),
    updatedAt: textOf(row.updated_at),
    recurrenceRuleId: textOrNull(row.recurrence_rule_id),
    overdue,
  };
}

function historyLabel(field: string, raw: string): string {
  if (!raw) return "없음";
  if (field === "status") return statusLabel(raw);
  try {
    const parsed = JSON.parse(raw) as { name?: string; date?: string; time?: string | null };
    if (field === "assignee") return parsed.name || "없음";
    if (field === "due") {
      if (!parsed.date) return "없음";
      return parsed.time ? `${parsed.date} ${parsed.time}` : `${parsed.date} 23:59`;
    }
  } catch {
    return raw;
  }
  return raw;
}

export function mapHistory(row: Row): HistoryDto {
  const field = textOf(row.field);
  const oldValue = textOf(row.old_value);
  const newValue = textOf(row.new_value);
  return {
    id: textOf(row.id),
    taskId: textOf(row.task_id),
    taskTitle: textOf(row.task_title),
    actorId: textOf(row.actor_id),
    actorName: textOf(row.actor_name),
    actorKind: textOf(row.actor_kind),
    field,
    oldValue,
    newValue,
    oldLabel: historyLabel(field, oldValue),
    newLabel: historyLabel(field, newValue),
    createdAt: textOf(row.created_at),
  };
}

export function mapComment(row: Row): CommentDto {
  return {
    id: textOf(row.id),
    taskId: textOf(row.task_id),
    authorId: textOf(row.author_id),
    authorName: textOf(row.author_name),
    authorRole: textOf(row.author_role),
    body: textOf(row.body),
    kind: textOf(row.kind),
    createdAt: textOf(row.created_at),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function optionalDate(value: unknown, label: string): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    throw new HttpError(400, "bad_date", `${label}은 YYYY-MM-DD 형식이어야 합니다.`);
  }
  return value;
}

function optionalTime(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !TIME_RE.test(value)) {
    throw new HttpError(400, "bad_time", "시각은 HH:MM 형식이어야 합니다.");
  }
  return value;
}

function cleanTags(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, "bad_tags", "태그는 목록이어야 합니다.");
  if (value.length > 12) throw new HttpError(400, "bad_tags", "태그는 12개까지입니다.");
  return value.map((item) => {
    if (typeof item !== "string" || item.trim() === "" || item.trim().length > 30) {
      throw new HttpError(400, "bad_tags", "태그는 1자에서 30자입니다.");
    }
    return item.trim();
  });
}

function cleanUrls(value: unknown): { label: string; url: string }[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, "bad_url", "관련 주소는 목록이어야 합니다.");
  if (value.length > 10) throw new HttpError(400, "bad_url", "관련 주소는 10개까지입니다.");
  return value.map((item) => {
    const record = item as { label?: unknown; url?: unknown };
    const url = typeof record?.url === "string" ? record.url.trim() : "";
    const label = typeof record?.label === "string" ? record.label.trim().slice(0, 80) : "";
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new HttpError(400, "bad_url", "관련 주소가 올바르지 않습니다.");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new HttpError(400, "bad_url", "관련 주소는 http 또는 https만 허용합니다.");
    }
    if (url.length > 500) throw new HttpError(400, "bad_url", "관련 주소가 너무 깁니다.");
    return { label: label || parsed.hostname, url };
  });
}

function cleanChecklist(value: unknown): { id: string; text: string; done: boolean }[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, "bad_checklist", "체크리스트 형식이 올바르지 않습니다.");
  if (value.length > 40) throw new HttpError(400, "bad_checklist", "체크리스트는 40개까지입니다.");
  return value.map((item) => {
    const record = item as { id?: unknown; text?: unknown; done?: unknown };
    const text = typeof record?.text === "string" ? record.text.trim() : "";
    if (!text || text.length > 300) throw new HttpError(400, "bad_checklist", "체크 항목은 1자에서 300자입니다.");
    const id = typeof record?.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(record.id) ? record.id : nid();
    return { id, text, done: record?.done === true };
  });
}

function dueAtFor(dueDate: string | null, dueTime: string | null): string | null {
  if (!dueDate) return null;
  return dueInstant(dueDate, dueTime).toISOString();
}

async function collaboratorIds(taskId: string, q: Query = sql): Promise<string[]> {
  const rows = await q("select member_id from task_collaborators where task_id = $1 order by member_id", [taskId]);
  return rows.map((row) => textOf(row.member_id));
}

async function loadTaskRow(id: string, realm: Realm, q: Query = sql): Promise<Row | null> {
  const rows = await q(`${TASK_SELECT} where t.id = $1 and t.realm = $2`, [id, realm]);
  return rows[0] ?? null;
}

export async function listTasks(realm: Realm, filters: TaskFilters, now = new Date()): Promise<{ tasks: TaskDto[]; total: number }> {
  const today = seoulDate(now);
  const week = weekRange(today);
  const next = weekRange(addDaysSafe(week.end, 1));
  const clauses = ["t.realm = $1"];
  const params: unknown[] = [realm];
  const add = (clause: string, value?: unknown) => {
    if (value !== undefined) {
      params.push(value);
      clauses.push(clause.replace("?", `$${params.length}`));
    } else {
      clauses.push(clause);
    }
  };
  if (filters.trashed) add("t.trashed_at is not null");
  else add("t.trashed_at is null");
  if (filters.scopeCategoryIds) {
    if (filters.scopeCategoryIds.length === 0) add("false");
    else {
      params.push(filters.scopeCategoryIds);
      clauses.push(`t.category_id = any(?::text[])`.replace("?", `$${params.length}`));
    }
  }
  if (filters.q) {
    params.push(`%${escapeLike(filters.q.slice(0, 100))}%`);
    clauses.push(`(t.title ilike $${params.length} escape '\\' or t.body ilike $${params.length} escape '\\')`);
  }
  if (filters.assignee === "me" && filters.viewerId) add("t.assignee_id = ?", filters.viewerId);
  else if (filters.assignee === "none") add("t.assignee_id is null");
  else if (filters.assignee) add("t.assignee_id = ?", filters.assignee);
  if (filters.categoryId) add("t.category_id = ?", filters.categoryId);
  if (filters.status) {
    if (!STATUSES.has(filters.status)) throw new HttpError(400, "bad_status", "알 수 없는 상태입니다.");
    add("t.status = ?", filters.status);
  }
  if (filters.priority) {
    if (!PRIORITIES.has(filters.priority)) throw new HttpError(400, "bad_priority", "알 수 없는 우선순위입니다.");
    add("t.priority = ?", filters.priority);
  }
  if (filters.bucket === "today") {
    add("t.due_date = ?", today);
    add("t.status <> 'done'");
    if (filters.viewerId) add("t.assignee_id = ?", filters.viewerId);
  } else if (filters.bucket === "week") {
    add("t.due_date >= ?", week.start);
    add("t.due_date <= ?", week.end);
    add("t.status <> 'done'");
    if (filters.viewerId) add("t.assignee_id = ?", filters.viewerId);
  } else if (filters.bucket === "all") {
    add("t.status <> 'done'");
    if (filters.viewerId) add("t.assignee_id = ?", filters.viewerId);
  } else if (filters.bucket === "done") {
    add("t.status = 'done'");
    if (filters.viewerId) add("t.assignee_id = ?", filters.viewerId);
  }
  if (filters.due === "overdue") {
    add("t.status <> 'done'");
    add("t.due_at < now()");
  } else if (filters.due === "today") add("t.due_date = ?", today);
  else if (filters.due === "week") {
    add("t.due_date >= ?", week.start);
    add("t.due_date <= ?", week.end);
  } else if (filters.due === "next") {
    add("t.due_date >= ?", next.start);
    add("t.due_date <= ?", next.end);
  } else if (filters.due === "none") add("t.due_date is null");
  if (filters.dueFrom) add("t.due_date >= ?", filters.dueFrom);
  if (filters.dueTo) add("t.due_date <= ?", filters.dueTo);
  const where = clauses.join(" and ");
  const countRows = await sql<{ n: number }>(`select count(*)::int as n from tasks t where ${where}`, params);
  const limit = Math.min(Math.max(filters.limit, 1), 100);
  const offset = Math.min(Math.max(filters.offset, 0), 5000);
  const rows = await sql(
    `${TASK_SELECT} where ${where} order by t.updated_at desc, t.id desc limit ${limit} offset ${offset}`,
    params,
  );
  return { tasks: rows.map((row) => mapTask(row, [], now)), total: Number(countRows[0]?.n ?? 0) };
}

function addDaysSafe(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

export async function getTaskDetail(realm: Realm, id: string, scope: string[] | null, now = new Date()) {
  const row = await loadTaskRow(id, realm);
  if (!row) throw new HttpError(404, "not_found", "작업을 찾을 수 없습니다.");
  if (scope && !scope.includes(textOf(row.category_id))) {
    throw new HttpError(404, "not_found", "작업을 찾을 수 없습니다.");
  }
  const task = mapTask(row, await collaboratorIds(id), now);
  const comments = await sql(
    `select c.*, m.name as author_name, m.role as author_role
     from comments c join members m on m.id = c.author_id
     where c.task_id = $1 order by c.created_at asc`,
    [id],
  );
  const history = await sql(
    `select h.*, m.name as actor_name
     from task_history h join members m on m.id = h.actor_id
     where h.task_id = $1 order by h.created_at asc`,
    [id],
  );
  let recurrence: { id: string; frequency: Frequency; active: boolean; startOn: string; untilOn: string | null } | null = null;
  if (task.recurrenceRuleId) {
    const rules = await sql("select * from recurrence_rules where id = $1 and realm = $2", [task.recurrenceRuleId, realm]);
    if (rules[0]) {
      recurrence = {
        id: textOf(rules[0].id),
        frequency: textOf(rules[0].frequency) as Frequency,
        active: boolOf(rules[0].active),
        startOn: textOf(rules[0].start_on),
        untilOn: textOrNull(rules[0].until_on),
      };
    }
  }
  return {
    task,
    comments: comments.map(mapComment),
    history: history.map(mapHistory),
    recurrence,
  };
}

async function assertCategory(q: Query, realm: Realm, categoryId: string): Promise<void> {
  const rows = await q("select active from categories where id = $1 and realm = $2", [categoryId, realm]);
  if (!rows[0] || !boolOf(rows[0].active)) throw new HttpError(400, "bad_category", "사용할 수 없는 분류입니다.");
}

async function assertAssignable(q: Query, realm: Realm, memberId: string): Promise<{ id: string; name: string }> {
  const rows = await q("select id, name, role, active from members where id = $1 and realm = $2", [memberId, realm]);
  const row = rows[0];
  if (!row || !boolOf(row.active) || row.role === "bot" || row.role === "viewer") {
    throw new HttpError(400, "bad_assignee", "담당자로 지정할 수 없는 구성원입니다.");
  }
  return { id: textOf(row.id), name: textOf(row.name) };
}

function canEdit(member: Member, row: Row): boolean {
  if (member.role === "admin" || member.role === "manager") return true;
  return member.role === "member" && textOf(row.assignee_id) === member.id;
}

function canReassign(member: Member): boolean {
  return member.role === "admin" || member.role === "manager";
}

async function writeHistory(
  q: Query,
  realm: Realm,
  taskId: string,
  actor: Member,
  field: "assignee" | "due" | "status",
  oldValue: string,
  newValue: string,
): Promise<void> {
  if (oldValue === newValue) return;
  await q(
    `insert into task_history (id, realm, task_id, actor_id, actor_kind, field, old_value, new_value)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [nid(), realm, taskId, actor.id, actor.role === "bot" ? "bot" : "human", field, oldValue, newValue],
  );
}

function assigneeSnap(id: string | null, name: string): string {
  if (!id) return "";
  return JSON.stringify({ id, name });
}

function dueSnap(date: string | null, time: string | null): string {
  if (!date) return "";
  return JSON.stringify({ date, time });
}

type TaskInput = {
  title?: unknown;
  body?: unknown;
  categoryId?: unknown;
  assigneeId?: unknown;
  collaboratorIds?: unknown;
  startDate?: unknown;
  dueDate?: unknown;
  dueTime?: unknown;
  priority?: unknown;
  status?: unknown;
  holdReason?: unknown;
  delayReason?: unknown;
  tags?: unknown;
  relatedUrls?: unknown;
  checklist?: unknown;
  version?: unknown;
  recurrence?: unknown;
  recurrenceActive?: unknown;
};

export async function createTask(member: Member, input: TaskInput, now = new Date()): Promise<TaskDto> {
  if (member.role === "viewer" || member.role === "bot") {
    throw new HttpError(403, "forbidden", "작업을 만들 권한이 없습니다.");
  }
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > 200) throw new HttpError(400, "bad_title", "제목은 1자에서 200자입니다.");
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (body.length > 20000) throw new HttpError(400, "bad_body", "본문이 너무 깁니다.");
  const priority = typeof input.priority === "string" ? input.priority : "normal";
  if (!PRIORITIES.has(priority)) throw new HttpError(400, "bad_priority", "알 수 없는 우선순위입니다.");
  const status = typeof input.status === "string" ? input.status : "todo";
  if (!STATUSES.has(status)) throw new HttpError(400, "bad_status", "알 수 없는 상태입니다.");
  const holdReason = typeof input.holdReason === "string" ? input.holdReason.trim() : "";
  if (status === "hold" && !holdReason) throw new HttpError(400, "hold_reason", "보류 사유를 입력하세요.");
  const delayReason = typeof input.delayReason === "string" ? input.delayReason.trim() : "";
  const startDate = optionalDate(input.startDate, "시작일");
  const dueDate = optionalDate(input.dueDate, "마감일");
  const dueTime = optionalTime(input.dueTime);
  if (dueTime && !dueDate) throw new HttpError(400, "bad_date", "시각만 있고 마감일이 없습니다.");
  if (startDate && dueDate && startDate > dueDate) throw new HttpError(400, "bad_date", "시작일이 마감일보다 늦습니다.");
  const tags = input.tags === undefined ? [] : cleanTags(input.tags);
  const relatedUrls = input.relatedUrls === undefined ? [] : cleanUrls(input.relatedUrls);
  const checklist = input.checklist === undefined ? [] : cleanChecklist(input.checklist);
  const recurrence = parseRecurrence(input.recurrence);
  return withTransaction(async (q) => {
    const categoryId = typeof input.categoryId === "string" ? input.categoryId : await defaultCategory(q, member.realm);
    await assertCategory(q, member.realm, categoryId);
    let assigneeId: string | null = member.role === "viewer" ? null : member.id;
    let assigneeName = member.name;
    if (input.assigneeId === null) {
      if (!canReassign(member)) throw new HttpError(403, "forbidden", "담당자를 비울 권한이 없습니다.");
      assigneeId = null;
      assigneeName = "";
    } else if (typeof input.assigneeId === "string" && input.assigneeId !== member.id) {
      if (!canReassign(member)) throw new HttpError(403, "forbidden", "담당자를 바꿀 권한이 없습니다.");
      const person = await assertAssignable(q, member.realm, input.assigneeId);
      assigneeId = person.id;
      assigneeName = person.name;
    } else if (typeof input.assigneeId === "string") {
      const person = await assertAssignable(q, member.realm, input.assigneeId);
      assigneeId = person.id;
      assigneeName = person.name;
    }
    const collaborators = Array.isArray(input.collaboratorIds) ? input.collaboratorIds.map(String) : [];
    if (collaborators.length > 20) throw new HttpError(400, "bad_assignee", "협업자는 20명까지입니다.");
    for (const collaboratorId of collaborators) await assertAssignable(q, member.realm, collaboratorId);
    const id = nid();
    let ruleId: string | null = null;
    let occurrenceKey: string | null = null;
    let nextDue = dueDate;
    let nextStart = startDate;
    if (recurrence) {
      const occurrenceDate = dueDate ?? startDate ?? seoulDate(now);
      ruleId = nid();
      occurrenceKey = `${ruleId}:${occurrenceDate}`;
      nextDue = dueDate ?? occurrenceDate;
      nextStart = startDate ?? occurrenceDate;
      await q(
        `insert into recurrence_rules (
          id, realm, frequency, title, body, category_id, assignee_id, priority, due_time,
          tags, related_urls, checklist, collaborator_ids, start_on, until_on, active, created_by
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,true,$16)`,
        [
          ruleId,
          member.realm,
          recurrence.frequency,
          title,
          body,
          categoryId,
          assigneeId,
          priority,
          dueTime,
          JSON.stringify(tags),
          JSON.stringify(relatedUrls),
          JSON.stringify(checklist),
          JSON.stringify(collaborators),
          occurrenceDate,
          recurrence.until,
          member.id,
        ],
      );
    }
    const completedAt = status === "done" ? now.toISOString() : null;
    await q(
      `insert into tasks (
        id, realm, title, body, category_id, assignee_id, creator_id, start_date, due_date, due_time, due_at,
        priority, status, hold_reason, delay_reason, tags, related_urls, checklist, version, completed_at,
        recurrence_rule_id, occurrence_key
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18::jsonb,1,$19,$20,$21
      )`,
      [
        id,
        member.realm,
        title,
        body,
        categoryId,
        assigneeId,
        member.id,
        nextStart,
        nextDue,
        dueTime,
        dueAtFor(nextDue, dueTime),
        priority,
        status,
        holdReason,
        delayReason,
        JSON.stringify(tags),
        JSON.stringify(relatedUrls),
        JSON.stringify(checklist),
        completedAt,
        ruleId,
        occurrenceKey,
      ],
    );
    for (const collaboratorId of collaborators) {
      if (collaboratorId === assigneeId) continue;
      await q("insert into task_collaborators (task_id, member_id) values ($1, $2) on conflict do nothing", [id, collaboratorId]);
    }
    await writeHistory(q, member.realm, id, member, "status", "", status);
    await writeHistory(q, member.realm, id, member, "assignee", "", assigneeSnap(assigneeId, assigneeName));
    await writeHistory(q, member.realm, id, member, "due", "", dueSnap(nextDue, dueTime));
    const row = await loadTaskRow(id, member.realm, q);
    if (!row) throw new HttpError(500, "server_error", "작업을 저장하지 못했습니다.");
    return mapTask(row, await collaboratorIds(id, q), now);
  });
}

function parseRecurrence(value: unknown): { frequency: Frequency; until: string | null } | null {
  if (value == null || value === false) return null;
  if (typeof value !== "object") throw new HttpError(400, "bad_recurrence", "반복 설정이 올바르지 않습니다.");
  const record = value as { frequency?: unknown; until?: unknown };
  if (record.frequency !== "daily" && record.frequency !== "weekly" && record.frequency !== "monthly") {
    throw new HttpError(400, "bad_recurrence", "반복은 매일, 매주, 매월 중 하나입니다.");
  }
  return { frequency: record.frequency, until: optionalDate(record.until, "반복 종료일") };
}

async function defaultCategory(q: Query, realm: Realm): Promise<string> {
  const rows = await q(
    "select id from categories where realm = $1 and active = true order by case when name = '기타' then 0 else 1 end, sort_order limit 1",
    [realm],
  );
  if (!rows[0]) throw new HttpError(400, "bad_category", "분류가 없습니다.");
  return textOf(rows[0].id);
}

export async function updateTask(member: Member, taskId: string, input: TaskInput, now = new Date()): Promise<TaskDto> {
  if (member.role === "bot") {
    throw new HttpError(403, "bot_forbidden", "봇은 담당자 변경, 기한 변경, 완료, 삭제를 할 수 없습니다.");
  }
  if (typeof input.version !== "number" || !Number.isInteger(input.version)) {
    throw new HttpError(400, "version_required", "버전 번호가 필요합니다.");
  }
  const version = input.version;
  return withTransaction(async (q) => {
    const locked = await q("select * from tasks where id = $1 and realm = $2 for update", [taskId, member.realm]);
    const current = locked[0];
    if (!current || current.trashed_at) throw new HttpError(404, "not_found", "작업을 찾을 수 없습니다.");
    if (numOf(current.version) !== version) {
      throw new HttpError(409, "conflict", "다른 수정이 먼저 저장되었습니다. 다시 불러온 뒤 저장하세요.", {
        currentVersion: numOf(current.version),
      });
    }
    if (!canEdit(member, current)) throw new HttpError(403, "forbidden", "담당 작업만 수정할 수 있습니다.");
    const sets: string[] = [];
    const params: unknown[] = [];
    const push = (column: string, value: unknown) => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };
    let changed = false;
    if (input.title !== undefined) {
      const title = typeof input.title === "string" ? input.title.trim() : "";
      if (!title || title.length > 200) throw new HttpError(400, "bad_title", "제목은 1자에서 200자입니다.");
      push("title", title);
      changed = true;
    }
    if (input.body !== undefined) {
      const body = typeof input.body === "string" ? input.body.trim() : "";
      if (body.length > 20000) throw new HttpError(400, "bad_body", "본문이 너무 깁니다.");
      push("body", body);
      changed = true;
    }
    if (input.categoryId !== undefined) {
      if (typeof input.categoryId !== "string") throw new HttpError(400, "bad_category", "분류가 올바르지 않습니다.");
      if (input.categoryId !== textOf(current.category_id)) await assertCategory(q, member.realm, input.categoryId);
      push("category_id", input.categoryId);
      changed = true;
    }
    if (input.priority !== undefined) {
      if (typeof input.priority !== "string" || !PRIORITIES.has(input.priority)) {
        throw new HttpError(400, "bad_priority", "알 수 없는 우선순위입니다.");
      }
      push("priority", input.priority);
      changed = true;
    }
    if (input.tags !== undefined) {
      params.push(JSON.stringify(cleanTags(input.tags)));
      sets.push(`tags = $${params.length}::jsonb`);
      changed = true;
    }
    if (input.relatedUrls !== undefined) {
      params.push(JSON.stringify(cleanUrls(input.relatedUrls)));
      sets.push(`related_urls = $${params.length}::jsonb`);
      changed = true;
    }
    if (input.checklist !== undefined) {
      params.push(JSON.stringify(cleanChecklist(input.checklist)));
      sets.push(`checklist = $${params.length}::jsonb`);
      changed = true;
    }
    if (input.delayReason !== undefined) {
      const delayReason = typeof input.delayReason === "string" ? input.delayReason.trim() : "";
      if (delayReason.length > 1000) throw new HttpError(400, "bad_body", "지연 사유가 너무 깁니다.");
      push("delay_reason", delayReason);
      changed = true;
    }
    if (input.holdReason !== undefined) {
      const holdReason = typeof input.holdReason === "string" ? input.holdReason.trim() : "";
      if (holdReason.length > 1000) throw new HttpError(400, "bad_body", "보류 사유가 너무 깁니다.");
      push("hold_reason", holdReason);
      changed = true;
    }
    let nextStatus = textOf(current.status);
    if (input.status !== undefined) {
      if (typeof input.status !== "string" || !STATUSES.has(input.status)) {
        throw new HttpError(400, "bad_status", "알 수 없는 상태입니다.");
      }
      nextStatus = input.status;
      const holdReason = input.holdReason !== undefined ? String(input.holdReason).trim() : textOf(current.hold_reason);
      if (nextStatus === "hold" && !holdReason) throw new HttpError(400, "hold_reason", "보류 사유를 입력하세요.");
      push("status", nextStatus);
      if (nextStatus === "done" && textOf(current.status) !== "done") push("completed_at", now.toISOString());
      if (nextStatus !== "done" && textOf(current.status) === "done") push("completed_at", null);
      changed = true;
      await writeHistory(q, member.realm, taskId, member, "status", textOf(current.status), nextStatus);
    }
    if (input.assigneeId !== undefined) {
      const nextId = input.assigneeId === null ? null : String(input.assigneeId);
      if (nextId !== textOrNull(current.assignee_id)) {
        if (!canReassign(member)) throw new HttpError(403, "forbidden", "담당자를 바꿀 권한이 없습니다.");
        let nextName = "";
        if (nextId) {
          const person = await assertAssignable(q, member.realm, nextId);
          nextName = person.name;
        }
        push("assignee_id", nextId);
        const previous = await assigneeName(q, textOrNull(current.assignee_id));
        await writeHistory(
          q,
          member.realm,
          taskId,
          member,
          "assignee",
          assigneeSnap(textOrNull(current.assignee_id), previous),
          assigneeSnap(nextId, nextName),
        );
        changed = true;
      }
    }
    let nextDue = textOrNull(current.due_date);
    let nextTime = textOrNull(current.due_time);
    let dueChanged = false;
    if (input.dueDate !== undefined) {
      nextDue = optionalDate(input.dueDate, "마감일");
      dueChanged = true;
    }
    if (input.dueTime !== undefined) {
      nextTime = optionalTime(input.dueTime);
      dueChanged = true;
    }
    if (input.startDate !== undefined) {
      const startDate = optionalDate(input.startDate, "시작일");
      push("start_date", startDate);
      changed = true;
      if (startDate && nextDue && startDate > nextDue) throw new HttpError(400, "bad_date", "시작일이 마감일보다 늦습니다.");
    }
    if (dueChanged) {
      if (nextTime && !nextDue) throw new HttpError(400, "bad_date", "시각만 있고 마감일이 없습니다.");
      const start = input.startDate !== undefined ? optionalDate(input.startDate, "시작일") : textOrNull(current.start_date);
      if (start && nextDue && start > nextDue) throw new HttpError(400, "bad_date", "시작일이 마감일보다 늦습니다.");
      push("due_date", nextDue);
      push("due_time", nextTime);
      push("due_at", dueAtFor(nextDue, nextTime));
      await writeHistory(
        q,
        member.realm,
        taskId,
        member,
        "due",
        dueSnap(textOrNull(current.due_date), textOrNull(current.due_time)),
        dueSnap(nextDue, nextTime),
      );
      changed = true;
    }
    if (input.collaboratorIds !== undefined) {
      if (!Array.isArray(input.collaboratorIds)) throw new HttpError(400, "bad_assignee", "협업자 형식이 올바르지 않습니다.");
      const ids = [...new Set(input.collaboratorIds.map(String))].slice(0, 20);
      for (const collaboratorId of ids) await assertAssignable(q, member.realm, collaboratorId);
      await q("delete from task_collaborators where task_id = $1", [taskId]);
      for (const collaboratorId of ids) {
        await q("insert into task_collaborators (task_id, member_id) values ($1, $2)", [taskId, collaboratorId]);
      }
      changed = true;
    }
    if (input.recurrenceActive !== undefined && current.recurrence_rule_id) {
      await q("update recurrence_rules set active = $1 where id = $2 and realm = $3", [
        input.recurrenceActive === true,
        textOf(current.recurrence_rule_id),
        member.realm,
      ]);
      changed = true;
    }
    if (!changed) throw new HttpError(400, "bad_request", "바꿀 내용이 없습니다.");
    params.push(taskId, version);
    const assignment = sets.length > 0 ? `${sets.join(", ")}, ` : "";
    const updated = await q(
      `update tasks set ${assignment}version = version + 1, updated_at = now()
       where id = $${params.length - 1} and version = $${params.length} returning id`,
      params,
    );
    if (!updated[0]) {
      throw new HttpError(409, "conflict", "다른 수정이 먼저 저장되었습니다. 다시 불러온 뒤 저장하세요.");
    }
    const row = await loadTaskRow(taskId, member.realm, q);
    if (!row) throw new HttpError(404, "not_found", "작업을 찾을 수 없습니다.");
    return mapTask(row, await collaboratorIds(taskId, q), now);
  });
}

async function assigneeName(q: Query, id: string | null): Promise<string> {
  if (!id) return "";
  const rows = await q("select name from members where id = $1", [id]);
  return textOf(rows[0]?.name);
}

export async function trashTask(member: Member, taskId: string, version: number, now = new Date()): Promise<TaskDto> {
  if (member.role === "bot" || member.role === "viewer") {
    throw new HttpError(403, "bot_forbidden", "봇은 담당자 변경, 기한 변경, 완료, 삭제를 할 수 없습니다.");
  }
  return withTransaction(async (q) => {
    const rows = await q("select * from tasks where id = $1 and realm = $2 for update", [taskId, member.realm]);
    const current = rows[0];
    if (!current || current.trashed_at) throw new HttpError(404, "not_found", "작업을 찾을 수 없습니다.");
    if (numOf(current.version) !== version) {
      throw new HttpError(409, "conflict", "다른 수정이 먼저 저장되었습니다. 다시 불러온 뒤 저장하세요.", {
        currentVersion: numOf(current.version),
      });
    }
    const allowed =
      member.role === "admin" ||
      member.role === "manager" ||
      textOf(current.assignee_id) === member.id ||
      textOf(current.creator_id) === member.id;
    if (!allowed) throw new HttpError(403, "forbidden", "이 작업을 휴지통으로 옮길 수 없습니다.");
    await q(
      "update tasks set trashed_at = now(), version = version + 1, updated_at = now() where id = $1 and version = $2",
      [taskId, version],
    );
    const row = await loadTaskRow(taskId, member.realm, q);
    if (!row) throw new HttpError(404, "not_found", "작업을 찾을 수 없습니다.");
    return mapTask(row, await collaboratorIds(taskId, q), now);
  });
}

export async function restoreTask(member: Member, taskId: string, version: number, now = new Date()): Promise<TaskDto> {
  if (member.role !== "admin" && member.role !== "manager" && member.role !== "member") {
    throw new HttpError(403, "forbidden", "복원할 권한이 없습니다.");
  }
  return withTransaction(async (q) => {
    const rows = await q("select * from tasks where id = $1 and realm = $2 for update", [taskId, member.realm]);
    const current = rows[0];
    if (!current || !current.trashed_at) throw new HttpError(404, "not_found", "휴지통에 없는 작업입니다.");
    if (numOf(current.version) !== version) {
      throw new HttpError(409, "conflict", "다른 수정이 먼저 저장되었습니다. 다시 불러온 뒤 저장하세요.", {
        currentVersion: numOf(current.version),
      });
    }
    const allowed =
      member.role === "admin" || member.role === "manager" || textOf(current.creator_id) === member.id;
    if (!allowed) throw new HttpError(403, "forbidden", "복원할 권한이 없습니다.");
    await q(
      "update tasks set trashed_at = null, version = version + 1, updated_at = now() where id = $1 and version = $2",
      [taskId, version],
    );
    const row = await loadTaskRow(taskId, member.realm, q);
    if (!row) throw new HttpError(404, "not_found", "작업을 찾을 수 없습니다.");
    return mapTask(row, await collaboratorIds(taskId, q), now);
  });
}

export async function bulkUpdate(
  member: Member,
  input: { tasks?: unknown; status?: unknown; assigneeId?: unknown; holdReason?: unknown },
  now = new Date(),
): Promise<TaskDto[]> {
  if (!Array.isArray(input.tasks) || input.tasks.length === 0 || input.tasks.length > 50) {
    throw new HttpError(400, "bad_request", "한 번에 1건에서 50건까지 바꿀 수 있습니다.");
  }
  const items = input.tasks.map((item) => {
    const record = item as { id?: unknown; version?: unknown };
    if (typeof record?.id !== "string" || typeof record.version !== "number") {
      throw new HttpError(400, "version_required", "각 작업의 버전 번호가 필요합니다.");
    }
    return { id: record.id, version: record.version };
  });
  const results: TaskDto[] = [];
  for (const item of items) {
    const patch: TaskInput = { version: item.version };
    if (input.status !== undefined) patch.status = input.status;
    if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId;
    if (input.holdReason !== undefined) patch.holdReason = input.holdReason;
    results.push(await updateTask(member, item.id, patch, now));
  }
  return results;
}

export async function addComment(
  member: Member,
  taskId: string,
  input: { body?: unknown; kind?: unknown; idempotencyKey?: unknown },
  scope: string[] | null,
): Promise<{ comment: CommentDto; duplicate: boolean }> {
  if (member.role === "viewer") throw new HttpError(403, "forbidden", "댓글을 쓸 권한이 없습니다.");
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!body || body.length > 4000) throw new HttpError(400, "bad_body", "댓글은 1자에서 4000자입니다.");
  const kind = input.kind == null ? "comment" : String(input.kind);
  if (member.role === "bot") {
    if (kind !== "comment" && kind !== "progress" && kind !== "checkin") {
      throw new HttpError(400, "bad_request", "봇 댓글 종류가 올바르지 않습니다.");
    }
  } else if (kind !== "comment") {
    throw new HttpError(403, "forbidden", "이 댓글 종류는 봇만 쓸 수 있습니다.");
  }
  const idempotencyKey = typeof input.idempotencyKey === "string" ? input.idempotencyKey.trim().slice(0, 200) : "";
  return withTransaction(async (q) => {
    const row = await loadTaskRow(taskId, member.realm, q);
    if (!row || row.trashed_at) throw new HttpError(404, "not_found", "작업을 찾을 수 없습니다.");
    if (scope && !scope.includes(textOf(row.category_id))) throw new HttpError(404, "not_found", "작업을 찾을 수 없습니다.");
    if (member.role !== "bot" && member.role !== "admin" && member.role !== "manager" && member.role !== "member") {
      throw new HttpError(403, "forbidden", "댓글을 쓸 권한이 없습니다.");
    }
    if (idempotencyKey) {
      const existing = await q(
        `select c.*, m.name as author_name, m.role as author_role
         from comments c join members m on m.id = c.author_id
         where c.realm = $1 and c.idempotency_key = $2`,
        [member.realm, idempotencyKey],
      );
      if (existing[0]) return { comment: mapComment(existing[0]), duplicate: true };
    }
    const id = nid();
    await q(
      `insert into comments (id, realm, task_id, author_id, body, kind, idempotency_key)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [id, member.realm, taskId, member.id, body, kind, idempotencyKey || null],
    );
    await q("update tasks set updated_at = now() where id = $1", [taskId]);
    const settings = await q("select notify_mentions from bot_settings where realm = $1", [member.realm]);
    if (settings[0] && boolOf(settings[0].notify_mentions)) {
      const people = await q(
        "select id, name, email from members where realm = $1 and active = true and role <> 'bot'",
        [member.realm],
      );
      const ids = mentionIds(body, people).filter((personId) => personId !== member.id);
      for (const personId of ids) {
        await insertNotification(q, {
          realm: member.realm,
          recipientId: personId,
          taskId,
          kind: "mention",
          title: "댓글에서 언급되었습니다",
          body: body.slice(0, 240),
          idempotencyKey: `mention:${id}:${personId}`,
        });
      }
    }
    const created = await q(
      `select c.*, m.name as author_name, m.role as author_role
       from comments c join members m on m.id = c.author_id where c.id = $1`,
      [id],
    );
    return { comment: mapComment(created[0]), duplicate: false };
  });
}

function mentionIds(body: string, people: Row[]): string[] {
  const sorted = [...people].sort((left, right) => textOf(right.name).length - textOf(left.name).length);
  const ids: string[] = [];
  for (const person of sorted) {
    const name = textOf(person.name);
    const email = textOf(person.email);
    if ((name && body.includes(`@${name}`)) || (email && body.includes(`@${email}`))) ids.push(textOf(person.id));
  }
  return [...new Set(ids)];
}

export async function insertNotification(
  q: Query,
  input: {
    realm: Realm;
    recipientId: string;
    taskId: string | null;
    kind: string;
    title: string;
    body: string;
    idempotencyKey: string;
  },
): Promise<{ id: string | null; duplicate: boolean }> {
  const rows = await q(
    `insert into notifications (id, realm, recipient_id, task_id, kind, title, body, idempotency_key)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (realm, idempotency_key) do nothing
     returning id`,
    [nid(), input.realm, input.recipientId, input.taskId, input.kind, input.title, input.body, input.idempotencyKey],
  );
  if (!rows[0]) return { id: null, duplicate: true };
  return { id: textOf(rows[0].id), duplicate: false };
}

export async function listNotifications(member: Member) {
  const rows = await sql(
    `select id, task_id, kind, title, body, read_at, created_at
     from notifications where recipient_id = $1 and realm = $2
     order by created_at desc limit 100`,
    [member.id, member.realm],
  );
  return rows.map((row) => ({
    id: textOf(row.id),
    taskId: textOrNull(row.task_id),
    kind: textOf(row.kind),
    title: textOf(row.title),
    body: textOf(row.body),
    readAt: textOrNull(row.read_at),
    createdAt: textOf(row.created_at),
  }));
}

export async function unreadCount(member: Member): Promise<number> {
  const rows = await sql<{ n: number }>(
    "select count(*)::int as n from notifications where recipient_id = $1 and read_at is null",
    [member.id],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function markRead(member: Member, id: string): Promise<void> {
  const rows = await sql(
    "update notifications set read_at = coalesce(read_at, now()) where id = $1 and recipient_id = $2 returning id",
    [id, member.id],
  );
  if (!rows[0]) throw new HttpError(404, "not_found", "알림을 찾을 수 없습니다.");
}

export async function markAllRead(member: Member): Promise<void> {
  await sql("update notifications set read_at = coalesce(read_at, now()) where recipient_id = $1 and read_at is null", [
    member.id,
  ]);
}

export async function listDirectory(realm: Realm) {
  const rows = await sql(
    "select id, name, role from members where realm = $1 and active = true and role <> 'bot' order by name, id",
    [realm],
  );
  return rows.map((row) => ({ id: textOf(row.id), name: textOf(row.name), role: textOf(row.role) }));
}

export async function listCategories(realm: Realm) {
  const rows = await sql("select * from categories where realm = $1 order by sort_order, name", [realm]);
  return rows.map((row) => ({
    id: textOf(row.id),
    name: textOf(row.name),
    sortOrder: numOf(row.sort_order),
    active: boolOf(row.active),
  }));
}

export function seoulClock(now = new Date()) {
  const parts = seoulParts(now);
  return { today: parts.date, time: parts.time, week: weekRange(parts.date) };
}

export async function scopeForBot(realm: Realm): Promise<string[] | null> {
  const rows = await sql("select scope_category_ids from bot_settings where realm = $1", [realm]);
  const value = rows[0]?.scope_category_ids;
  if (value == null) return null;
  return jsonOf<string[]>(value, []);
}
