import { statusLabel } from "../lib/labels";
import { addDays, businessDaysBetween, seoulDate, seoulDayFromInstant, weekRange } from "../lib/time";
import type { Realm } from "./auth";
import { loadSettings } from "./auth";
import { sql, type Row } from "./db";
import { boolOf, jsonOf, numOf, textOf, textOrNull } from "./http";
import { listTasks, mapHistory, mapTask, unreadCount, type TaskDto } from "./tasks";

export type ReportLine = {
  taskId: string;
  title: string;
  assignee: string;
  status: string;
  due: string;
  delayReason: string;
  note: string;
  href: string;
};

export type Report = {
  generatedAt: string;
  timezone: "Asia/Seoul";
  week: { start: string; end: string };
  nextWeek: { start: string; end: string };
  sections: {
    doneThisWeek: ReportLine[];
    inProgress: ReportLine[];
    overdue: ReportLine[];
    nextWeek: ReportLine[];
    byAssignee: { assigneeId: string; assignee: string; open: number; overdue: number; doneThisWeek: number }[];
  };
  text: string;
};

type Fact = {
  id: string;
  title: string;
  assigneeId: string;
  assignee: string;
  status: string;
  dueDate: string | null;
  dueTime: string | null;
  dueAt: string | null;
  delayReason: string;
  completedAt: string | null;
  updatedAt: string;
};

function line(task: Fact, note: string): ReportLine {
  const due = task.dueDate ? (task.dueTime ? `${task.dueDate} ${task.dueTime}` : `${task.dueDate} 23:59`) : "";
  return {
    taskId: task.id,
    title: task.title,
    assignee: task.assignee || "담당 없음",
    status: statusLabel(task.status),
    due,
    delayReason: task.delayReason,
    note,
    href: `/tasks/${task.id}`,
  };
}

function overdueNote(task: Fact): string {
  return task.delayReason.trim() ? task.delayReason.trim() : "사유 미입력";
}

export async function buildReport(realm: Realm, now = new Date()): Promise<Report> {
  const today = seoulDate(now);
  const week = weekRange(today);
  const nextWeek = weekRange(addDays(week.end, 1));
  const rows = await sql(
    `select t.id, t.title, t.assignee_id, coalesce(a.name, '') as assignee_name, t.status,
            t.due_date, t.due_time, t.due_at, t.delay_reason, t.completed_at, t.updated_at
     from tasks t
     left join members a on a.id = t.assignee_id
     where t.realm = $1 and t.trashed_at is null
     order by t.due_date nulls last, t.title`,
    [realm],
  );
  const facts = rows.map(toFact);
  const doneThisWeek = facts.filter((task) => task.status === "done" && task.completedAt && inRange(seoulDayFromInstant(new Date(task.completedAt)), week.start, week.end));
  const inProgress = facts.filter((task) => task.status === "in_progress");
  const overdue = facts.filter((task) => task.status !== "done" && task.dueAt && new Date(task.dueAt).getTime() < now.getTime());
  const upcoming = facts.filter((task) => task.status !== "done" && task.dueDate && task.dueDate >= nextWeek.start && task.dueDate <= nextWeek.end);
  const byAssignee = new Map<string, { assigneeId: string; assignee: string; open: number; overdue: number; doneThisWeek: number }>();
  const touch = (task: Fact) => {
    const key = task.assigneeId || "none";
    const current = byAssignee.get(key) ?? {
      assigneeId: task.assigneeId,
      assignee: task.assignee || "담당 없음",
      open: 0,
      overdue: 0,
      doneThisWeek: 0,
    };
    byAssignee.set(key, current);
    return current;
  };
  for (const task of facts) {
    if (task.status !== "done") touch(task).open += 1;
  }
  for (const task of overdue) touch(task).overdue += 1;
  for (const task of doneThisWeek) touch(task).doneThisWeek += 1;
  const sections = {
    doneThisWeek: doneThisWeek.map((task) => line(task, "이번 주 완료")),
    inProgress: inProgress.map((task) => line(task, "")),
    overdue: overdue.map((task) => line(task, overdueNote(task))),
    nextWeek: upcoming.map((task) => line(task, "")),
    byAssignee: [...byAssignee.values()].sort((left, right) => right.open - left.open || left.assignee.localeCompare(right.assignee, "ko")),
  };
  const text = renderText(now, week, nextWeek, sections);
  return { generatedAt: now.toISOString(), timezone: "Asia/Seoul", week, nextWeek, sections, text };
}

function toFact(row: Row): Fact {
  return {
    id: textOf(row.id),
    title: textOf(row.title),
    assigneeId: textOf(row.assignee_id),
    assignee: textOf(row.assignee_name),
    status: textOf(row.status),
    dueDate: textOrNull(row.due_date),
    dueTime: textOrNull(row.due_time),
    dueAt: textOrNull(row.due_at),
    delayReason: textOf(row.delay_reason),
    completedAt: textOrNull(row.completed_at),
    updatedAt: textOf(row.updated_at),
  };
}

function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function renderLines(title: string, items: ReportLine[]): string[] {
  const lines = [`[${title}] ${items.length}건`];
  if (items.length === 0) {
    lines.push("- 없음");
    return lines;
  }
  for (const item of items) {
    const bits = [`- ${item.taskId} ${item.href}`, item.title, `담당 ${item.assignee}`, item.status];
    if (item.due) bits.push(`기한 ${item.due}`);
    if (item.note) bits.push(item.note);
    lines.push(bits.join(" | "));
  }
  return lines;
}

function renderText(now: Date, week: { start: string; end: string }, nextWeek: { start: string; end: string }, sections: Report["sections"]): string {
  const parts = seoulDate(now);
  const clock = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
  const lines = [
    "물류자동화팀 현황",
    `기준 시각: ${parts} ${clock} (Asia/Seoul)`,
    `이번 주: ${week.start} ~ ${week.end}`,
    `다음 주: ${nextWeek.start} ~ ${nextWeek.end}`,
    "",
    ...renderLines("이번 주 완료", sections.doneThisWeek),
    "",
    ...renderLines("진행 중", sections.inProgress),
    "",
    ...renderLines("기한 지남", sections.overdue),
    "",
    ...renderLines("다음 주 마감", sections.nextWeek),
    "",
    "[담당자별]",
  ];
  if (sections.byAssignee.length === 0) lines.push("- 없음");
  for (const row of sections.byAssignee) {
    lines.push(`- ${row.assignee}: 미완료 ${row.open}건, 기한 지남 ${row.overdue}건, 이번 주 완료 ${row.doneThisWeek}건`);
  }
  return lines.join("\n");
}

export function reportCsv(report: Report): string {
  const header = ["section", "task_id", "title", "assignee", "status", "due", "note", "href"];
  const rows: [string, ReportLine][] = [
    ...report.sections.doneThisWeek.map((item): [string, ReportLine] => ["done_this_week", item]),
    ...report.sections.inProgress.map((item): [string, ReportLine] => ["in_progress", item]),
    ...report.sections.overdue.map((item): [string, ReportLine] => ["overdue", item]),
    ...report.sections.nextWeek.map((item): [string, ReportLine] => ["next_week", item]),
  ];
  const body = rows.map(([section, item]) =>
    [section, item.taskId, item.title, item.assignee, item.status, item.due, item.note, item.href].map(csvCell).join(","),
  );
  return `\uFEFF${header.join(",")}\n${body.join("\n")}\n`;
}

function csvCell(value: string): string {
  let safe = value ?? "";
  if (/^[=+\-@]/.test(safe)) safe = `'${safe}`;
  if (/[",\n\r]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`;
  return safe;
}

export async function projectCards(realm: Realm, now = new Date()) {
  const categories = await sql("select id, name, active, sort_order from categories where realm = $1 order by sort_order, name", [realm]);
  const tasks = await sql(
    "select category_id, status, due_at from tasks where realm = $1 and trashed_at is null",
    [realm],
  );
  return categories.map((category) => {
    const mine = tasks.filter((task) => textOf(task.category_id) === textOf(category.id));
    const all = mine.length;
    const done = mine.filter((task) => textOf(task.status) === "done").length;
    const overdue = mine.filter((task) => {
      if (textOf(task.status) === "done" || !task.due_at) return false;
      return new Date(textOf(task.due_at)).getTime() < now.getTime();
    }).length;
    return {
      id: textOf(category.id),
      name: textOf(category.name),
      active: boolOf(category.active),
      all,
      done,
      overdue,
      progress: all === 0 ? 0 : Math.round((done / all) * 100),
    };
  });
}

export async function buildDashboard(memberId: string, realm: Realm, now = new Date()) {
  const today = seoulDate(now);
  const week = weekRange(today);
  const [mineToday, mineOverdue, mineDueThisWeek, needsReview, recentRows, daily, weekly, unread, runs] = await Promise.all([
    listTasks(realm, { bucket: "today", viewerId: memberId, limit: 20, offset: 0 }, now),
    listTasks(realm, { assignee: "me", due: "overdue", viewerId: memberId, limit: 20, offset: 0 }, now),
    listTasks(realm, { bucket: "week", viewerId: memberId, limit: 20, offset: 0 }, now),
    listTasks(realm, { status: "review", limit: 20, offset: 0 }, now),
    sql(
      `select h.*, m.name as actor_name, t.title as task_title
       from task_history h
       join members m on m.id = h.actor_id
       join tasks t on t.id = h.task_id
       where h.realm = $1
       order by h.created_at desc
       limit 12`,
      [realm],
    ),
    sql("select period_key, body, created_at from summaries where realm = $1 and period = 'daily' order by period_key desc limit 1", [realm]),
    sql("select period_key, body, created_at from summaries where realm = $1 and period = 'weekly' order by period_key desc limit 1", [realm]),
    unreadCount({ id: memberId, realm, sub: "", email: "", name: "", role: "member", active: true }),
    sql(
      "select job_name, slot_key, status, error, finished_at from job_runs where realm = $1 order by started_at desc limit 20",
      [realm],
    ),
  ]);
  const openRows = await sql(
    `select t.assignee_id, coalesce(a.name, '담당 없음') as assignee_name, t.status, t.due_at
     from tasks t left join members a on a.id = t.assignee_id
     where t.realm = $1 and t.trashed_at is null and t.status <> 'done'`,
    [realm],
  );
  const workloadMap = new Map<string, { assigneeId: string | null; assigneeName: string; open: number; overdue: number }>();
  for (const row of openRows) {
    const key = textOf(row.assignee_id) || "none";
    const current = workloadMap.get(key) ?? {
      assigneeId: textOrNull(row.assignee_id),
      assigneeName: textOf(row.assignee_name) || "담당 없음",
      open: 0,
      overdue: 0,
    };
    current.open += 1;
    if (row.due_at && new Date(textOf(row.due_at)).getTime() < now.getTime()) current.overdue += 1;
    workloadMap.set(key, current);
  }
  const settings = await loadSettings(realm);
  const alerts = scheduleAlerts(settings, runs, now);
  alerts.unshift({
    level: "info" as const,
    text: "브라우저를 닫아도 돌아가는 예약 실행은 연결되어 있지 않습니다. 관리 화면의 ‘지금 실행’ 또는 POST /api/jobs/run 으로만 실행됩니다.",
  });
  return {
    today,
    week,
    mineToday: mineToday.tasks,
    mineOverdue: mineOverdue.tasks,
    mineDueThisWeek: mineDueThisWeek.tasks,
    needsReview: needsReview.tasks,
    workload: [...workloadMap.values()].sort((left, right) => right.open - left.open),
    recent: recentRows.map(mapHistory),
    summaries: {
      daily: summaryDto(daily[0]),
      weekly: summaryDto(weekly[0]),
    },
    alerts,
    unreadNotifications: unread,
  };
}

function summaryDto(row: Row | undefined) {
  if (!row) return null;
  return { periodKey: textOf(row.period_key), body: textOf(row.body), createdAt: textOf(row.created_at) };
}

export function scheduleAlerts(settings: Row, runs: Row[], now: Date) {
  const plans = describeSchedule(settings, now);
  const alerts: { level: "warning" | "info"; text: string }[] = [];
  for (const plan of plans) {
    if (!plan.enabled || !plan.lastDueSlot) continue;
    const success = runs.find((run) => textOf(run.job_name) === plan.job && textOf(run.slot_key) === plan.lastDueSlot && textOf(run.status) === "success");
    const failed = runs.find((run) => textOf(run.job_name) === plan.job && textOf(run.status) === "failed");
    if (failed && (!success || textOf(failed.finished_at) > textOf(success.finished_at))) {
      alerts.push({ level: "warning", text: `${plan.label} 실행이 실패했습니다. ${textOf(failed.error) || "오류 내용 없음"}` });
    } else if (!success) {
      alerts.push({ level: "warning", text: `${plan.label}의 예정 시각이 지났지만 성공 기록이 없습니다.` });
    }
  }
  return alerts;
}

export type SchedulePlan = {
  job: string;
  label: string;
  enabled: boolean;
  nextAt: string | null;
  lastDueSlot: string | null;
  holidayNote: string;
};

export function describeSchedule(settings: Row, now = new Date()): SchedulePlan[] {
  const businessDays = jsonOf<number[]>(settings.business_days, [1, 2, 3, 4, 5]);
  const holidays = jsonOf<string[]>(settings.holidays, []);
  const exclude = boolOf(settings.exclude_holidays);
  const holidayNote = exclude
    ? "휴일 제외가 켜져 있습니다. 등록한 날짜만 영업일에서 빠집니다."
    : "휴일은 영업일에서 제외하지 않습니다. 제외하려면 ‘휴일 제외’를 켜세요.";
  const jobs = [
    { job: "daily_summary", label: "오늘·기한 지남 요약", enabled: boolOf(settings.weekday_summary_enabled), time: textOf(settings.weekday_summary_time), kind: "business" as const },
    { job: "due_soon", label: "마감 전 알림", enabled: boolOf(settings.due_soon_enabled), time: textOf(settings.weekday_summary_time), kind: "daily" as const },
    { job: "overdue", label: "기한 지남 알림", enabled: boolOf(settings.overdue_enabled), time: textOf(settings.weekday_summary_time), kind: "daily" as const },
    { job: "stale_checkin", label: "진행 정체 확인", enabled: boolOf(settings.stale_enabled), time: textOf(settings.weekday_summary_time), kind: "daily" as const },
    { job: "weekly_draft", label: "주간 보고 초안", enabled: boolOf(settings.weekly_enabled), time: textOf(settings.weekly_time), kind: "weekly" as const },
    { job: "recurrence", label: "반복 작업 생성", enabled: boolOf(settings.recurrence_enabled), time: textOf(settings.recurrence_time), kind: "daily" as const },
  ];
  return jobs.map((job) => ({
    job: job.job,
    label: job.label,
    enabled: job.enabled,
    nextAt: job.enabled ? nextRun(job, settings, businessDays, holidays, exclude, now) : null,
    lastDueSlot: job.enabled ? lastDue(job, settings, businessDays, holidays, exclude, now) : null,
    holidayNote,
  }));
}

function matches(kind: "business" | "daily" | "weekly", date: string, settings: Row, businessDays: number[], holidays: string[], exclude: boolean): boolean {
  if (kind === "daily") return true;
  if (kind === "business") {
    return businessDays.includes(weekday(date)) && !(exclude && holidays.includes(date));
  }
  const dow = numOf(settings.weekly_dow);
  return weekday(date) === dow && !(exclude && holidays.includes(date));
}

function weekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function at(date: string, time: string): number {
  return new Date(`${date}T${time}:00.000+09:00`).getTime();
}

function nextRun(
  job: { time: string; kind: "business" | "daily" | "weekly" },
  settings: Row,
  businessDays: number[],
  holidays: string[],
  exclude: boolean,
  now: Date,
): string | null {
  const today = seoulDate(now);
  for (let step = 0; step < 21; step += 1) {
    const date = addDays(today, step);
    if (!matches(job.kind, date, settings, businessDays, holidays, exclude)) continue;
    if (at(date, job.time) > now.getTime()) return new Date(at(date, job.time)).toISOString();
  }
  return null;
}

function lastDue(
  job: { job: string; time: string; kind: "business" | "daily" | "weekly" },
  settings: Row,
  businessDays: number[],
  holidays: string[],
  exclude: boolean,
  now: Date,
): string | null {
  const today = seoulDate(now);
  for (let step = 0; step < 21; step += 1) {
    const date = addDays(today, -step);
    if (!matches(job.kind, date, settings, businessDays, holidays, exclude)) continue;
    if (at(date, job.time) <= now.getTime()) {
      return job.job === "weekly_draft" ? weekRange(date).start : date;
    }
  }
  return null;
}

export function isJobDue(job: string, settings: Row, now: Date): boolean {
  const plan = describeSchedule(settings, now).find((item) => item.job === job);
  if (!plan?.enabled) return false;
  const today = seoulDate(now);
  const slot = job === "weekly_draft" ? weekRange(today).start : today;
  return plan.lastDueSlot === slot;
}

export async function staleTasks(realm: Realm, now = new Date()): Promise<TaskDto[]> {
  const settings = await loadSettings(realm);
  const businessDays = jsonOf<number[]>(settings.business_days, [1, 2, 3, 4, 5]);
  const holidays = jsonOf<string[]>(settings.holidays, []);
  const exclude = boolOf(settings.exclude_holidays);
  const needed = numOf(settings.stale_business_days) || 3;
  const rows = await sql(
    `select t.id, t.title, t.body, t.category_id, c.name as category_name,
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
     where t.realm = $1 and t.trashed_at is null and t.status = 'in_progress'`,
    [realm],
  );
  const today = seoulDate(now);
  return rows
    .filter((row) => {
      const updated = seoulDayFromInstant(new Date(textOf(row.updated_at)));
      return businessDaysBetween(updated, today, businessDays, holidays, exclude) >= needed;
    })
    .map((row) => mapTask(row, [], now));
}

export { businessDaysBetween };
