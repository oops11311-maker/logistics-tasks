import type { Frequency } from "../lib/labels";
import { addDays, businessDaysBetween, seoulDate, seoulDayFromInstant, weekRange, weekdayOf } from "../lib/time";
import type { Member, Realm } from "./auth";
import { botMember, loadSettings } from "./auth";
import { sql, withTransaction, type Row } from "./db";
import { HttpError, boolOf, jsonOf, nid, numOf, textOf, textOrNull } from "./http";
import { describeSchedule, buildReport, staleTasks } from "./reports";
import { dueInstant } from "../lib/time";
import { insertNotification, scopeForBot } from "./tasks";

const JOBS = ["daily_summary", "due_soon", "overdue", "stale_checkin", "weekly_draft", "recurrence"] as const;
type JobName = (typeof JOBS)[number];

export function isJobName(value: string): value is JobName {
  return (JOBS as readonly string[]).includes(value);
}

function slotFor(job: JobName, date: string): string {
  return job === "weekly_draft" ? weekRange(date).start : date;
}

export async function runJobs(input: { realm: Realm; force: boolean; only?: string; now?: Date }) {
  const now = input.now ?? new Date();
  const settings = await loadSettings(input.realm);
  const bot = await botMember(input.realm);
  const names = input.only ? [input.only] : [...JOBS];
  const results = [];
  for (const name of names) {
    if (!isJobName(name)) throw new HttpError(400, "bad_job", "알 수 없는 작업입니다.");
    results.push(await runOne(name, input.realm, settings, bot, input.force, now));
  }
  return { schedulingActive: false, results };
}

async function runOne(job: JobName, realm: Realm, settings: Row, bot: Member, force: boolean, now: Date) {
  const plan = describeSchedule(settings, now).find((item) => item.job === job);
  if (!force && (!plan?.enabled || !plan.lastDueSlot)) {
    return { job, status: plan?.enabled ? "not_due" : "disabled", slotKey: null as string | null };
  }
  const today = seoulDate(now);
  const slotKey = force ? slotFor(job, today) : plan?.lastDueSlot ?? slotFor(job, today);
  const claim = await claimRun(realm, job, slotKey);
  if (claim === "skip") return { job, status: "already_done", slotKey };
  try {
    const detail = await execute(job, realm, settings, bot, now);
    await sql(
      "update job_runs set status = 'success', error = '', detail = $1::jsonb, finished_at = now() where realm = $2 and job_name = $3 and slot_key = $4",
      [JSON.stringify(detail), realm, job, slotKey],
    );
    return { job, status: "success", slotKey, detail };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "실행 오류";
    await sql(
      "update job_runs set status = 'failed', error = $1, finished_at = now() where realm = $2 and job_name = $3 and slot_key = $4",
      [message, realm, job, slotKey],
    );
    return { job, status: "failed", slotKey, error: message };
  }
}

async function claimRun(realm: Realm, job: string, slotKey: string): Promise<"run" | "skip"> {
  return withTransaction(async (q) => {
    const existing = await q("select * from job_runs where realm = $1 and job_name = $2 and slot_key = $3 for update", [
      realm,
      job,
      slotKey,
    ]);
    if (!existing[0]) {
      await q(
        "insert into job_runs (id, realm, job_name, slot_key, status) values ($1, $2, $3, $4, 'running')",
        [nid(), realm, job, slotKey],
      );
      return "run";
    }
    if (textOf(existing[0].status) === "success") return "skip";
    const started = new Date(textOf(existing[0].started_at)).getTime();
    if (textOf(existing[0].status) === "running" && Date.now() - started < 5 * 60 * 1000) return "skip";
    await q("update job_runs set status = 'running', error = '', started_at = now(), finished_at = null where id = $1", [
      textOf(existing[0].id),
    ]);
    return "run";
  });
}

async function execute(job: JobName, realm: Realm, settings: Row, bot: Member, now: Date) {
  if (job === "daily_summary") return dailySummary(realm, bot, now);
  if (job === "due_soon") return dueSoon(realm, settings, now);
  if (job === "overdue") return overdue(realm, settings, now);
  if (job === "stale_checkin") return staleCheckin(realm, settings, bot, now);
  if (job === "weekly_draft") return weeklyDraft(realm, bot, now);
  return spawnRecurrences(realm, now);
}

async function saveSummary(realm: Realm, period: "daily" | "weekly", periodKey: string, body: string, createdBy: string) {
  const inserted = await sql(
    `insert into summaries (id, realm, period, period_key, body, created_by)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (realm, period, period_key) do nothing
     returning id`,
    [nid(), realm, period, periodKey, body, createdBy],
  );
  return { created: inserted.length > 0 };
}

async function dailySummary(realm: Realm, bot: Member, now: Date) {
  const today = seoulDate(now);
  const report = await buildReport(realm, now);
  const dueToday = report.sections.nextWeek.length;
  const lines = [
    `오늘(${today})과 기한이 지난 작업만 적습니다.`,
    ...report.text.split("\n").filter((line) => line.startsWith("[기한 지남]") || line.startsWith("- ") && report.sections.overdue.some((item) => line.includes(item.taskId)) || line.startsWith("기준") || line.startsWith("물류")),
  ];
  const todayTasks = await sql(
    `select t.id, t.title, coalesce(a.name, '담당 없음') as assignee_name, t.assignee_id
     from tasks t left join members a on a.id = t.assignee_id
     where t.realm = $1 and t.trashed_at is null and t.status <> 'done' and t.due_date = $2`,
    [realm, today],
  );
  const body = [
    `물류자동화팀 오늘 요약 (${today}, Asia/Seoul)`,
    `오늘 마감 ${todayTasks.length}건`,
    ...todayTasks.map((row) => `- ${textOf(row.id)} /tasks/${textOf(row.id)} | ${textOf(row.title)} | 담당 ${textOf(row.assignee_name)}`),
    todayTasks.length === 0 ? "- 없음" : "",
    `기한 지남 ${report.sections.overdue.length}건`,
    ...report.sections.overdue.map((item) => `- ${item.taskId} ${item.href} | ${item.title} | 담당 ${item.assignee} | ${item.note}`),
    report.sections.overdue.length === 0 ? "- 없음" : "",
  ].filter((line) => line !== "").join("\n");
  const saved = await saveSummary(realm, "daily", today, body, bot.id);
  const recipients = new Set<string>();
  for (const row of todayTasks) if (row.assignee_id) recipients.add(textOf(row.assignee_id));
  for (const item of report.sections.overdue) {
    const task = await sql("select assignee_id from tasks where id = $1", [item.taskId]);
    if (task[0]?.assignee_id) recipients.add(textOf(task[0].assignee_id));
  }
  const admins = await sql("select id from members where realm = $1 and active = true and role = 'admin'", [realm]);
  for (const admin of admins) recipients.add(textOf(admin.id));
  let notified = 0;
  for (const recipientId of recipients) {
    const result = await insertNotification(sql, {
      realm,
      recipientId,
      taskId: null,
      kind: "daily_summary",
      title: `${today} 오늘·지연 요약`,
      body: body.slice(0, 500),
      idempotencyKey: `daily-summary:${today}:${recipientId}`,
    });
    if (!result.duplicate) notified += 1;
  }
  return { saved: saved.created, notified, dueTodayCount: todayTasks.length, overdue: report.sections.overdue.length, ignored: dueToday };
}

async function dueSoon(realm: Realm, settings: Row, now: Date) {
  if (!boolOf(settings.notify_due_soon)) return { notified: 0, skipped: "notifications_off" };
  const days = numOf(settings.due_soon_days) || 1;
  const target = addDays(seoulDate(now), days);
  const rows = await sql(
    `select id, title, assignee_id from tasks
     where realm = $1 and trashed_at is null and status <> 'done' and due_date = $2 and assignee_id is not null`,
    [realm, target],
  );
  let notified = 0;
  for (const row of rows) {
    const result = await insertNotification(sql, {
      realm,
      recipientId: textOf(row.assignee_id),
      taskId: textOf(row.id),
      kind: "due_soon",
      title: days === 1 ? "내일 마감" : `${days}일 후 마감`,
      body: `${textOf(row.title)} (${textOf(row.id)}) 마감일 ${target}`,
      idempotencyKey: `due-soon:${textOf(row.id)}:${target}`,
    });
    if (!result.duplicate) notified += 1;
  }
  return { notified, target };
}

async function overdue(realm: Realm, settings: Row, now: Date) {
  if (!boolOf(settings.notify_overdue)) return { notified: 0, skipped: "notifications_off" };
  const today = seoulDate(now);
  const rows = await sql(
    `select id, title, assignee_id, due_date, delay_reason from tasks
     where realm = $1 and trashed_at is null and status <> 'done' and due_at < now() and assignee_id is not null`,
    [realm],
  );
  let notified = 0;
  for (const row of rows) {
    const reason = textOf(row.delay_reason).trim() || "사유 미입력";
    const result = await insertNotification(sql, {
      realm,
      recipientId: textOf(row.assignee_id),
      taskId: textOf(row.id),
      kind: "overdue",
      title: "기한이 지났습니다",
      body: `${textOf(row.title)} (${textOf(row.id)}) 마감 ${textOf(row.due_date)} | ${reason}`,
      idempotencyKey: `overdue:${textOf(row.id)}:${today}`,
    });
    if (!result.duplicate) notified += 1;
  }
  return { notified };
}

async function staleCheckin(realm: Realm, settings: Row, bot: Member, now: Date) {
  const tasks = await staleTasks(realm, now);
  const scope = await scopeForBot(realm);
  let comments = 0;
  let notified = 0;
  for (const task of tasks) {
    if (scope && !scope.includes(task.categoryId)) continue;
    const updatedDay = seoulDayFromInstant(new Date(task.updatedAt));
    const elapsed = businessDaysBetween(
      updatedDay,
      seoulDate(now),
      jsonOf<number[]>(settings.business_days, [1, 2, 3, 4, 5]),
      jsonOf<string[]>(settings.holidays, []),
      boolOf(settings.exclude_holidays),
    );
    const key = `checkin:${task.id}:${task.updatedAt}`;
    const existing = await sql("select id from comments where realm = $1 and idempotency_key = $2", [realm, key]);
    if (!existing[0]) {
      await sql(
        `insert into comments (id, realm, task_id, author_id, body, kind, idempotency_key)
         values ($1, $2, $3, $4, $5, 'checkin', $6)`,
        [
          nid(),
          realm,
          task.id,
          bot.id,
          `진행 중 상태로 ${elapsed} 영업일 동안 업데이트가 없습니다. 마지막 수정: ${updatedDay}.`,
          key,
        ],
      );
      await sql("update tasks set updated_at = now() where id = $1", [task.id]);
      comments += 1;
    }
    if (boolOf(settings.notify_stale) && task.assigneeId) {
      const result = await insertNotification(sql, {
        realm,
        recipientId: task.assigneeId,
        taskId: task.id,
        kind: "stale",
        title: "진행 상황 확인",
        body: `${task.title} (${task.id})이 ${elapsed} 영업일 동안 갱신되지 않았습니다.`,
        idempotencyKey: `stale:${task.id}:${task.updatedAt}`,
      });
      if (!result.duplicate) notified += 1;
    }
  }
  return { comments, notified };
}

async function weeklyDraft(realm: Realm, bot: Member, now: Date) {
  const report = await buildReport(realm, now);
  const key = report.week.start;
  const saved = await saveSummary(realm, "weekly", key, report.text, bot.id);
  const admins = await sql(
    "select id from members where realm = $1 and active = true and role in ('admin', 'manager')",
    [realm],
  );
  let notified = 0;
  for (const admin of admins) {
    const result = await insertNotification(sql, {
      realm,
      recipientId: textOf(admin.id),
      taskId: null,
      kind: "weekly_draft",
      title: `주간 보고 초안 ${key}`,
      body: report.text.slice(0, 500),
      idempotencyKey: `weekly-draft:${key}:${textOf(admin.id)}`,
    });
    if (!result.duplicate) notified += 1;
  }
  return { saved: saved.created, notified };
}

function monthMatch(startOn: string, today: string): boolean {
  const startDay = Number(startOn.slice(8, 10));
  const [year, month, day] = today.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const target = Math.min(startDay, last);
  return day === target;
}

export async function spawnRecurrences(realm: Realm, now = new Date()) {
  const today = seoulDate(now);
  const rules = await sql("select * from recurrence_rules where realm = $1 and active = true", [realm]);
  let created = 0;
  for (const rule of rules) {
    const startOn = textOf(rule.start_on);
    const untilOn = textOrNull(rule.until_on);
    if (today < startOn) continue;
    if (untilOn && today > untilOn) continue;
    const frequency = textOf(rule.frequency) as Frequency;
    const matches =
      frequency === "daily" ||
      (frequency === "weekly" && weekdayOf(today) === weekdayOf(startOn)) ||
      (frequency === "monthly" && monthMatch(startOn, today));
    if (!matches) continue;
    const key = `${textOf(rule.id)}:${today}`;
    const dueTime = textOrNull(rule.due_time);
    const inserted = await sql(
      `insert into tasks (
        id, realm, title, body, category_id, assignee_id, creator_id, start_date, due_date, due_time, due_at,
        priority, status, tags, related_urls, checklist, recurrence_rule_id, occurrence_key
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,'todo',$12::jsonb,$13::jsonb,$14::jsonb,$15,$16
      ) on conflict (realm, occurrence_key) where occurrence_key is not null do nothing
      returning id`,
      [
        nid(),
        realm,
        textOf(rule.title),
        textOf(rule.body),
        textOf(rule.category_id),
        textOrNull(rule.assignee_id),
        textOf(rule.created_by),
        today,
        dueTime,
        dueInstant(today, dueTime).toISOString(),
        textOf(rule.priority),
        JSON.stringify(jsonOf(rule.tags, [])),
        JSON.stringify(jsonOf(rule.related_urls, [])),
        JSON.stringify(jsonOf(rule.checklist, [])),
        textOf(rule.id),
        key,
      ],
    );
    if (inserted[0]) {
      created += 1;
      const collaborators = jsonOf<string[]>(rule.collaborator_ids, []);
      for (const memberId of collaborators) {
        await sql("insert into task_collaborators (task_id, member_id) values ($1, $2) on conflict do nothing", [
          textOf(inserted[0].id),
          memberId,
        ]);
      }
    }
  }
  return { created };
}

export async function recordBotRun(realm: Realm, input: { jobName?: unknown; slotKey?: unknown; status?: unknown; error?: unknown }) {
  const jobName = typeof input.jobName === "string" ? input.jobName.slice(0, 80) : "";
  const slotKey = typeof input.slotKey === "string" ? input.slotKey.slice(0, 80) : "";
  const status = input.status === "success" || input.status === "failed" ? input.status : "";
  if (!jobName || !slotKey || !status) throw new HttpError(400, "bad_request", "작업 이름, 슬롯, 상태가 필요합니다.");
  const error = typeof input.error === "string" ? input.error.slice(0, 300) : "";
  await sql(
    `insert into job_runs (id, realm, job_name, slot_key, status, error, finished_at)
     values ($1, $2, $3, $4, $5, $6, now())
     on conflict (realm, job_name, slot_key) do update
       set status = excluded.status, error = excluded.error, finished_at = now()`,
    [nid(), realm, jobName, slotKey, status, error],
  );
  return { ok: true };
}
