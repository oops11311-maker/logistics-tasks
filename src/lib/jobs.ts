import type { Actor, AppSettings, Stage } from "./access";
import { botActor, loadHolidays, loadSettings } from "./access";
import { sql, withTransaction, type QueryFn } from "./db";
import { asDate, asIso, id } from "./format";
import { HttpError } from "./http";
import { dailySummary, buildReport } from "./reports";
import { followingDate, spawnOccurrence } from "./tasks";
import {
  addDays,
  atSeoul,
  minutes,
  seoulDate,
  seoulMinutes,
  shiftBusinessDays,
  weekdayOf,
} from "./time";

type JobState = {
  job_name: string;
  last_success_at: unknown;
  last_success_slot: string | null;
  last_error_at: unknown;
  last_error: string | null;
  retry_count: number;
  next_due_at: unknown;
};

type TemplateRow = {
  id: string;
  stage: string;
  title: string;
  body: string;
  category_id: string | null;
  owner_id: string;
  creator_id: string;
  due_time: string | null;
  priority: string;
  checklist: unknown;
  tags: unknown;
  links: unknown;
  recurrence_freq: string | null;
  recurrence_interval: number | null;
  recurrence_business_days: boolean | null;
  recurrence_dom: number | null;
  recurrence_until: unknown;
  next_run_on: unknown;
  active: boolean;
};

export type JobResult = {
  job: string;
  status: "success" | "skipped" | "error";
  reason?: string;
  slot?: string;
  created?: number;
  alerts?: number;
  error?: string;
};

function scheduledDay(weekdays: number[], clock: string, now: Date, lastSlot: string | null) {
  const today = seoulDate(now);
  let cursor = today;
  for (let index = 0; index < 21; index += 1) {
    if (weekdays.includes(weekdayOf(cursor))) {
      if (lastSlot === cursor) {
        cursor = addDays(cursor, 1);
        continue;
      }
      const at = atSeoul(cursor, clock);
      return {
        slot: cursor,
        at: at.toISOString(),
        overdue: at.getTime() < now.getTime(),
      };
    }
    cursor = addDays(cursor, 1);
  }
  return null;
}

export async function describeJobs(stage: string, now = new Date()) {
  const settings = await loadSettings(stage);
  const states = await sql<JobState>(
    `select job_name, last_success_at, last_success_slot, last_error_at, last_error, retry_count, next_due_at
     from job_state where stage = $1`,
    [stage],
  );
  const byName = new Map(states.map((row) => [row.job_name, row]));
  const dueTemplates = await sql<{ n: number }>(
    `select count(*)::int as n from tasks
     where stage = $1 and is_template = true and next_run_on is not null and next_run_on <= $2::date`,
    [stage, seoulDate(now)],
  );
  const jobs = ["recurrence", "morning", "weekly"].map((name) => {
    const state = byName.get(name);
    const lastErrorAt = asIso(state?.last_error_at);
    const lastSuccessAt = asIso(state?.last_success_at);
    let next: { slot: string; at: string; overdue: boolean } | null = null;
    let message = "";
    if (name === "morning") {
      next = scheduledDay(settings.bot.summaryWeekdays, settings.bot.summaryTime, now, state?.last_success_slot ?? null);
      message = "평일 오늘·지연 요약과 마감 알림";
    } else if (name === "weekly") {
      next = scheduledDay([settings.bot.weeklyWeekday], settings.bot.weeklyTime, now, state?.last_success_slot ?? null);
      message = "주간 보고서 초안";
    } else {
      const today = seoulDate(now);
      const ranToday = state?.last_success_slot === today;
      const overdue = Number(dueTemplates[0]?.n ?? 0) > 0 && !ranToday && seoulMinutes(now) >= minutes("09:00");
      next = {
        slot: today,
        at: atSeoul(ranToday ? addDays(today, 1) : today, "09:00").toISOString(),
        overdue,
      };
      message = "반복 업무 생성";
    }
    const failed = Boolean(lastErrorAt && (!lastSuccessAt || lastErrorAt > lastSuccessAt));
    const warning = failed || Boolean(next?.overdue);
    return {
      job: name,
      label: message,
      lastSuccessAt,
      lastSuccessSlot: state?.last_success_slot ?? null,
      lastErrorAt,
      lastError: state?.last_error ?? null,
      retryCount: Number(state?.retry_count ?? 0),
      nextDueAt: next?.at ?? null,
      nextSlot: next?.slot ?? null,
      warning,
      warningText: failed
        ? `최근 실행이 실패했습니다. ${state?.last_error ?? ""}`.trim()
        : next?.overdue
          ? "예정 시각이 지났지만 성공 기록이 없습니다. 무인 스케줄은 켜져 있지 않습니다."
          : "",
    };
  });
  return jobs;
}

async function saveState(
  query: QueryFn,
  stage: string,
  job: string,
  result: JobResult,
  now: Date,
  nextDue: string | null,
) {
  if (result.status === "success") {
    await query(
      `update job_state set
         last_success_at = $3, last_success_slot = $4, last_error = null, retry_count = 0,
         next_due_at = $5, updated_at = now()
       where stage = $1 and job_name = $2`,
      [stage, job, now.toISOString(), result.slot ?? null, nextDue],
    );
    return;
  }
  if (result.status === "error") {
    await query(
      `update job_state set
         last_error_at = $3, last_error = $4, retry_count = retry_count + 1, next_due_at = $5, updated_at = now()
       where stage = $1 and job_name = $2`,
      [stage, job, now.toISOString(), result.error ?? "오류", nextDue],
    );
  }
}

async function insertAlert(
  query: QueryFn,
  stage: string,
  task: { id: string; title: string; owner_id: string },
  kind: string,
  body: string,
  dedupe: string,
  notifyOwner: boolean,
): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `insert into alerts (id, stage, task_id, member_id, kind, body, dedupe_key)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (dedupe_key) do nothing
     returning id`,
    [id(), stage, task.id, task.owner_id, kind, body, dedupe],
  );
  if (!rows[0] || !notifyOwner) return Boolean(rows[0]);
  await query(
    `insert into notifications (id, stage, member_id, task_id, kind, title, body, dedupe_key)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (dedupe_key) do nothing`,
    [id(), stage, task.owner_id, task.id, kind, "업무 알림", body, `notify:${dedupe}`],
  );
  return true;
}

async function runRecurrence(stage: Stage, now: Date, actor: Actor, settings: AppSettings): Promise<JobResult> {
  const today = seoulDate(now);
  const holidays = await loadHolidays(stage);
  try {
    let created = 0;
    await withTransaction(async (query) => {
      const templates = await query<TemplateRow>(
        `select t.*, m.active
         from tasks t join members m on m.id = t.owner_id
         where t.stage = $1 and t.is_template = true and t.next_run_on is not null and t.next_run_on <= $2::date`,
        [stage, today],
      );
      for (const template of templates) {
        if (!template.active) continue;
        let cursor = asDate(template.next_run_on);
        let guard = 0;
        while (cursor && cursor <= today && guard < 24) {
          const occurrenceId = await spawnOccurrence(query, stage, template as never, cursor, actor);
          if (occurrenceId) created += 1;
          const next = followingDate(template as never, cursor, holidays, settings.excludeHolidays);
          await query(`update tasks set next_run_on = $3::date, updated_at = now() where id = $1 and stage = $2`, [
            template.id,
            stage,
            next,
          ]);
          if (!next) break;
          cursor = next;
          guard += 1;
        }
      }
    });
    return { job: "recurrence", status: "success", slot: today, created };
  } catch (error) {
    return { job: "recurrence", status: "error", slot: today, error: failureText(error) };
  }
}

async function runMorning(stage: Stage, now: Date, settings: AppSettings): Promise<JobResult> {
  const today = seoulDate(now);
  if (!settings.bot.summaryWeekdays.includes(weekdayOf(today))) {
    return { job: "morning", status: "skipped", reason: "not_a_scheduled_day", slot: today };
  }
  const state = await sql<JobState>(
    `select job_name, last_success_at, last_success_slot, last_error_at, last_error, retry_count, next_due_at
     from job_state where stage = $1 and job_name = 'morning'`,
    [stage],
  );
  if (state[0]?.last_success_slot === today) {
    return { job: "morning", status: "skipped", reason: "already_ran", slot: today };
  }
  try {
    const summary = await dailySummary(stage, now);
    const holidays = await loadHolidays(stage);
    let alerts = 0;
    await withTransaction(async (query) => {
      await query(
        `insert into summaries (id, stage, kind, period_key, body)
         values ($1, $2, 'daily', $3, $4)
         on conflict (stage, period_key) do update set body = excluded.body`,
        [id(), stage, summary.periodKey, summary.body],
      );
      const tasks = await query<{
        id: string;
        title: string;
        owner_id: string;
        status: string;
        due_date: unknown;
        due_at: unknown;
        updated_at: unknown;
      }>(
        `select id, title, owner_id, status, due_date, due_at, updated_at
         from tasks
         where stage = $1 and deleted_at is null and is_template = false and status <> '완료'`,
        [stage],
      );
      const cutoff = shiftBusinessDays(today, -settings.bot.staleBusinessDays, holidays, settings.excludeHolidays);
      for (const task of tasks) {
        const dueDate = asDate(task.due_date);
        const dueAt = asIso(task.due_at);
        const updated = asIso(task.updated_at);
        if (
          settings.notifications.dueSoon &&
          settings.bot.dueSoonBusinessDays > 0 &&
          dueDate &&
          shiftBusinessDays(dueDate, -settings.bot.dueSoonBusinessDays, holidays, settings.excludeHolidays) === today
        ) {
          const inserted = await insertAlert(
            query,
            stage,
            task,
            "due_soon",
            `${task.title} 마감이 다가옵니다. (${dueDate})`,
            `due-soon:${stage}:${task.id}:${dueDate}`,
            true,
          );
          if (inserted) alerts += 1;
        }
        if (settings.notifications.overdue && settings.bot.overdueAlerts && dueAt && new Date(dueAt).getTime() < now.getTime() && dueDate) {
          const inserted = await insertAlert(
            query,
            stage,
            task,
            "overdue",
            `${task.title} 마감이 지났습니다. (${dueDate})`,
            `overdue:${stage}:${task.id}:${dueDate}`,
            true,
          );
          if (inserted) alerts += 1;
        }
        const updatedDate = updated ? seoulDate(new Date(updated)) : null;
        if (settings.notifications.stale && task.status === "진행 중" && updatedDate && updatedDate <= cutoff && updated) {
          const inserted = await insertAlert(
            query,
            stage,
            task,
            "stale",
            `${task.title} 진행 중 상태가 ${settings.bot.staleBusinessDays}영업일 동안 갱신되지 않았습니다.`,
            `stale:${stage}:${task.id}:${updated}`,
            true,
          );
          if (inserted) alerts += 1;
        }
      }
    });
    return { job: "morning", status: "success", slot: today, alerts };
  } catch (error) {
    return { job: "morning", status: "error", slot: today, error: failureText(error) };
  }
}

async function runWeekly(stage: Stage, now: Date, settings: AppSettings): Promise<JobResult> {
  const today = seoulDate(now);
  if (weekdayOf(today) !== settings.bot.weeklyWeekday) {
    return { job: "weekly", status: "skipped", reason: "not_today", slot: today };
  }
  const slot = `week:${startOfThisWeek(today)}`;
  const state = await sql<JobState>(
    `select job_name, last_success_at, last_success_slot, last_error_at, last_error, retry_count, next_due_at
     from job_state where stage = $1 and job_name = 'weekly'`,
    [stage],
  );
  if (state[0]?.last_success_slot === slot) {
    return { job: "weekly", status: "skipped", reason: "already_ran", slot };
  }
  try {
    const report = await buildReport({ stage, kind: "human", role: "admin", memberId: "", name: "", email: "" }, now);
    const body = `주간 보고서 초안\n${report.text}`;
    await sql(
      `insert into summaries (id, stage, kind, period_key, body)
       values ($1, $2, 'weekly', $3, $4)
       on conflict (stage, period_key) do update set body = excluded.body`,
      [id(), stage, slot, body],
    );
    return { job: "weekly", status: "success", slot };
  } catch (error) {
    return { job: "weekly", status: "error", slot, error: failureText(error) };
  }
}

function failureText(error: unknown): string {
  if (process.env.LOGISTICS_TEST_AUTH === "1" && error instanceof Error) return error.message.slice(0, 240);
  return error instanceof Error ? error.name : "error";
}

function startOfThisWeek(today: string): string {
  const weekday = weekdayOf(today);
  const fromMonday = weekday === 0 ? 6 : weekday - 1;
  return addDays(today, -fromMonday);
}

export async function runScheduler(stage: Stage, now = new Date(), source = "manual"): Promise<{ results: JobResult[] }> {
  const settings = await loadSettings(stage);
  const actor = await botActor(stage);
  const results = [
    await runRecurrence(stage, now, actor, settings),
    await runMorning(stage, now, settings),
    await runWeekly(stage, now, settings),
  ];
  const described = await describeJobs(stage, now);
  for (const result of results) {
    const next = described.find((job) => job.job === result.job)?.nextDueAt ?? null;
    await saveState(sql, stage, result.job, result, now, next);
    await sql(
      `insert into job_runs (id, stage, source, job_name, status, error, detail, finished_at)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, now())`,
      [id(), stage, source, result.job, result.status, result.error ?? null, JSON.stringify(result)],
    );
  }
  return { results };
}

export async function recordExternalRun(
  stage: Stage,
  body: Record<string, unknown>,
): Promise<{ id: string; status: string; duplicate: boolean }> {
  const job = typeof body.job === "string" ? body.job : "";
  const status = body.status === "error" ? "error" : body.status === "success" ? "success" : "";
  if (!/^[a-z0-9_-]{1,40}$/.test(job) || status === "") {
    throw new HttpError(400, "invalid", "작업 이름과 성공 또는 오류 상태가 필요합니다.");
  }
  const error = typeof body.error === "string" ? body.error.slice(0, 500) : null;
  const key = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (key && !/^[A-Za-z0-9:_-]{1,80}$/.test(key)) {
    throw new HttpError(400, "invalid", "멱등 키 형식이 올바르지 않습니다.");
  }
  if (key) {
    const existing = await sql<{ id: string; status: string }>(
      `select id, status from job_runs where stage = $1 and idempotency_key = $2`,
      [stage, key],
    );
    if (existing[0] && existing[0].status !== "error") {
      return { id: existing[0].id, status: existing[0].status, duplicate: true };
    }
  }
  const runId = id();
  const detail = { note: typeof body.detail === "string" ? body.detail.slice(0, 2000) : "" };
  if (key) {
    await sql(
      `insert into job_runs (id, stage, source, job_name, status, error, detail, idempotency_key, finished_at)
       values ($1, $2, 'bot', $3, $4, $5, $6::jsonb, $7, now())
       on conflict (stage, idempotency_key) where idempotency_key is not null
       do update set status = excluded.status, error = excluded.error, detail = excluded.detail, finished_at = now()`,
      [runId, stage, job, status, error, JSON.stringify(detail), key],
    );
  } else {
    await sql(
      `insert into job_runs (id, stage, source, job_name, status, error, detail, finished_at)
       values ($1, $2, 'bot', $3, $4, $5, $6::jsonb, now())`,
      [runId, stage, job, status, error, JSON.stringify(detail)],
    );
  }
  if (job === "morning" || job === "weekly" || job === "recurrence") {
    const slot = job === "weekly" ? `week:${startOfThisWeek(seoulDate())}` : seoulDate();
    if (status === "success") {
      await sql(
        `update job_state set last_success_at = now(), last_success_slot = $3, last_error = null, retry_count = 0, updated_at = now()
         where stage = $1 and job_name = $2`,
        [stage, job, slot],
      );
    } else {
      await sql(
        `update job_state set last_error_at = now(), last_error = $3, retry_count = retry_count + 1, updated_at = now()
         where stage = $1 and job_name = $2`,
        [stage, job, error ?? "오류"],
      );
    }
  }
  return { id: runId, status, duplicate: false };
}

export async function saveBotSummary(stage: Stage, body: Record<string, unknown>) {
  const kind = body.kind === "weekly" ? "weekly" : body.kind === "daily" ? "daily" : "";
  const periodKey = typeof body.periodKey === "string" ? body.periodKey : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!kind || text.length < 1 || text.length > 20_000) {
    throw new HttpError(400, "invalid", "요약 본문을 확인하세요.");
  }
  if (!/^(daily|weekly):\d{4}-\d{2}-\d{2}$/.test(periodKey) || !periodKey.startsWith(kind)) {
    throw new HttpError(400, "invalid", "요약 기간 키가 올바르지 않습니다.");
  }
  await sql(
    `insert into summaries (id, stage, kind, period_key, body)
     values ($1, $2, $3, $4, $5)
     on conflict (stage, period_key) do update set body = excluded.body`,
    [id(), stage, kind, periodKey, text],
  );
  return { periodKey, kind };
}

export async function saveBotAlert(stage: Stage, scope: string[] | null, body: Record<string, unknown>) {
  const taskId = typeof body.taskId === "string" ? body.taskId : "";
  const kind = typeof body.kind === "string" ? body.kind : "custom";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const key = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(taskId) || text.length < 1 || text.length > 2000) {
    throw new HttpError(400, "invalid", "알림 내용을 확인하세요.");
  }
  if (!/^[a-z0-9_-]{1,40}$/.test(kind) || !/^[A-Za-z0-9:_-]{1,80}$/.test(key)) {
    throw new HttpError(400, "invalid", "알림 종류와 멱등 키가 필요합니다.");
  }
  const tasks = await sql<{ id: string; title: string; owner_id: string; category_id: string | null; status: string; due_date: unknown }>(
    `select id, title, owner_id, category_id, status, due_date from tasks
     where id = $1 and stage = $2 and is_template = false and deleted_at is null`,
    [taskId, stage],
  );
  const task = tasks[0];
  if (!task || (scope && scope.length > 0 && (!task.category_id || !scope.includes(task.category_id)))) {
    throw new HttpError(404, "not_found", "업무를 찾지 못했습니다.");
  }
  const before = await sql<{ status: string; owner_id: string; due_date: unknown; deleted_at: unknown }>(
    `select status, owner_id, due_date, deleted_at from tasks where id = $1`,
    [taskId],
  );
  const inserted = await withTransaction(async (query) =>
    insertAlert(query, stage, task, kind, text, `${stage}:${key}`, true),
  );
  const after = await sql<{ status: string; owner_id: string; due_date: unknown; deleted_at: unknown }>(
    `select status, owner_id, due_date, deleted_at from tasks where id = $1`,
    [taskId],
  );
  if (JSON.stringify(before[0]) !== JSON.stringify(after[0])) {
    throw new HttpError(500, "server", "알림이 업무를 바꾸려 했습니다.");
  }
  return { created: inserted, taskId };
}

export function botScope(settings: AppSettings): string[] | null {
  return settings.bot.categoryIds.length > 0 ? settings.bot.categoryIds : null;
}
