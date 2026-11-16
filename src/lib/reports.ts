import type { Actor } from "./access";
import { sql } from "./db";
import { asDate, asIso, csvCell } from "./format";
import { addDays, endOfWeek, seoulDate, seoulToUtc, startOfWeek } from "./time";

export type ReportLine = {
  id: string;
  href: string;
  title: string;
  status: string;
  priority: string;
  ownerId: string;
  ownerName: string;
  dueDate: string | null;
  delayReason: string | null;
  completedAt: string | null;
};

export type Report = {
  generatedAt: string;
  timezone: "Asia/Seoul";
  week: { start: string; end: string };
  nextWeek: { start: string; end: string };
  doneThisWeek: ReportLine[];
  inProgress: ReportLine[];
  overdue: ReportLine[];
  nextWeekTasks: ReportLine[];
  byAssignee: { id: string; name: string; open: number; overdue: number; doneThisWeek: number }[];
  text: string;
  csv: string;
};

type Raw = {
  id: string;
  title: string;
  status: string;
  priority: string;
  owner_id: string;
  owner_name: string;
  due_date: unknown;
  delay_reason: string | null;
  completed_at: unknown;
};

function line(row: Raw): ReportLine {
  return {
    id: row.id,
    href: `/tasks/${row.id}`,
    title: row.title,
    status: row.status,
    priority: row.priority,
    ownerId: row.owner_id,
    ownerName: row.owner_name || "이름 없음",
    dueDate: asDate(row.due_date),
    delayReason: row.delay_reason,
    completedAt: asIso(row.completed_at),
  };
}

function delayLabel(reason: string | null): string {
  const text = reason?.trim() ?? "";
  return text === "" ? "사유 미입력" : text;
}

function section(title: string, rows: ReportLine[], extra?: (row: ReportLine) => string): string {
  if (rows.length === 0) return `${title}\n없음`;
  return [
    title,
    ...rows.map((row) => {
      const tail = extra ? ` / ${extra(row)}` : "";
      return `- ${row.title} / ${row.ownerName} / ${row.status}${tail} / ${row.href}`;
    }),
  ].join("\n");
}

export function renderReport(report: Omit<Report, "text" | "csv">): { text: string; csv: string } {
  const text = [
    `물류자동화팀 보고서 (서울 ${report.week.start}–${report.week.end})`,
    section(`이번 주 완료 ${report.doneThisWeek.length}건`, report.doneThisWeek),
    section(`진행 중 ${report.inProgress.length}건`, report.inProgress),
    section(
      `마감 지남 ${report.overdue.length}건`,
      report.overdue,
      (row) => delayLabel(row.delayReason),
    ),
    section(`다음 주 마감 ${report.nextWeekTasks.length}건`, report.nextWeekTasks, (row) => row.dueDate ?? "마감 없음"),
    "담당자별",
    ...report.byAssignee.map(
      (row) => `- ${row.name} / 진행 ${row.open} / 지연 ${row.overdue} / 이번 주 완료 ${row.doneThisWeek} / /team?assigneeId=${row.id}`,
    ),
  ].join("\n");
  const header = ["구분", "제목", "담당", "상태", "마감", "지연 사유", "링크"];
  const rows: string[][] = [];
  const push = (group: string, items: ReportLine[]) => {
    for (const item of items) {
      rows.push([
        group,
        item.title,
        item.ownerName,
        item.status,
        item.dueDate ?? "",
        group === "마감 지남" ? delayLabel(item.delayReason) : (item.delayReason ?? ""),
        item.href,
      ]);
    }
  };
  push("이번 주 완료", report.doneThisWeek);
  push("진행 중", report.inProgress);
  push("마감 지남", report.overdue);
  push("다음 주", report.nextWeekTasks);
  const csv = [header, ...rows].map((cells) => cells.map((cell) => csvCell(cell)).join(",")).join("\n");
  return { text, csv };
}

export async function buildReport(actor: Actor, now = new Date()): Promise<Report> {
  const today = seoulDate(now);
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const nextStart = addDays(weekStart, 7);
  const nextEnd = addDays(nextStart, 6);
  const weekFrom = seoulToUtc(weekStart, 0, 0, 0, 0).toISOString();
  const nextFrom = seoulToUtc(nextStart, 0, 0, 0, 0).toISOString();
  const base = `t.stage = $1 and t.deleted_at is null and t.is_template = false`;
  const select = `select t.id, t.title, t.status, t.priority, t.owner_id, m.name as owner_name,
      t.due_date, t.delay_reason, t.completed_at
    from tasks t join members m on m.id = t.owner_id`;
  const done = await sql<Raw>(
    `${select} where ${base} and t.status = '완료' and t.completed_at >= $2::timestamptz and t.completed_at < $3::timestamptz
     order by t.completed_at desc limit 500`,
    [actor.stage, weekFrom, nextFrom],
  );
  const progress = await sql<Raw>(
    `${select} where ${base} and t.status = '진행 중' order by t.updated_at desc limit 500`,
    [actor.stage],
  );
  const overdue = await sql<Raw>(
    `${select} where ${base} and t.status <> '완료' and t.due_at < $2::timestamptz
     order by t.due_at asc limit 500`,
    [actor.stage, now.toISOString()],
  );
  const upcoming = await sql<Raw>(
    `${select} where ${base} and t.status <> '완료'
       and to_char(t.due_date, 'YYYY-MM-DD') >= $2 and to_char(t.due_date, 'YYYY-MM-DD') <= $3
     order by t.due_date asc limit 500`,
    [actor.stage, nextStart, nextEnd],
  );
  const byAssignee = await sql<{ id: string; name: string; open: number; overdue: number; done_this_week: number }>(
    `select m.id, m.name,
        count(t.id) filter (where t.id is not null and t.status <> '완료')::int as open,
        count(t.id) filter (where t.status <> '완료' and t.due_at < $2::timestamptz)::int as overdue,
        count(t.id) filter (
          where t.status = '완료' and t.completed_at >= $3::timestamptz and t.completed_at < $4::timestamptz
        )::int as done_this_week
     from members m
     left join tasks t
       on t.owner_id = m.id and t.stage = m.stage and t.deleted_at is null and t.is_template = false
     where m.stage = $1 and m.active = true and m.role <> 'bot'
     group by m.id, m.name
     order by m.name`,
    [actor.stage, now.toISOString(), weekFrom, nextFrom],
  );
  const report = {
    generatedAt: now.toISOString(),
    timezone: "Asia/Seoul" as const,
    week: { start: weekStart, end: weekEnd },
    nextWeek: { start: nextStart, end: nextEnd },
    doneThisWeek: done.map(line),
    inProgress: progress.map(line),
    overdue: overdue.map(line),
    nextWeekTasks: upcoming.map(line),
    byAssignee: byAssignee.map((row) => ({
      id: row.id,
      name: row.name,
      open: Number(row.open),
      overdue: Number(row.overdue),
      doneThisWeek: Number(row.done_this_week),
    })),
  };
  const rendered = renderReport(report);
  return { ...report, ...rendered };
}

export async function dailySummary(stage: string, now = new Date()): Promise<{ periodKey: string; body: string }> {
  const today = seoulDate(now);
  const actor = { stage } as Actor;
  const report = await buildReport(actor, now);
  const todayTasks = await sql<Raw>(
    `select t.id, t.title, t.status, t.priority, t.owner_id, m.name as owner_name, t.due_date, t.delay_reason, t.completed_at
     from tasks t join members m on m.id = t.owner_id
     where t.stage = $1 and t.deleted_at is null and t.is_template = false
       and t.status <> '완료' and to_char(t.due_date, 'YYYY-MM-DD') = $2
     order by t.title`,
    [stage, today],
  );
  const lines = todayTasks.map(line);
  const body = [
    `오늘·지연 요약 (서울 ${today})`,
    section(`오늘 마감 ${lines.length}건`, lines),
    section(`마감 지남 ${report.overdue.length}건`, report.overdue, (row) => delayLabel(row.delayReason)),
    section(`진행 중 ${report.inProgress.length}건`, report.inProgress),
  ].join("\n");
  return { periodKey: `daily:${today}`, body };
}
