import assert from "node:assert/strict";
import { before, test } from "node:test";
import { businessDaysBetween, seoulDate, addDays } from "../src/lib/time";
import { resetLocalDatabase, sql } from "../src/server/db";
import { handle } from "../src/server/handle";
import { resetRateLimits } from "../src/server/rate";

process.env.BOT_API_TOKEN = "test-bot-token";
process.env.SCHEDULER_TOKEN = "test-scheduler-token";

type Identify = (request: Request) => Promise<{
  verified: boolean;
  kind?: string;
  sub?: string;
  email?: string;
  name?: string;
  stage?: string;
  simulated?: boolean;
}>;

function person(sub: string, email: string, name: string, stage = "production"): Identify {
  return async () => ({ verified: true, kind: "person", sub, email, name, stage, simulated: false });
}

async function call(
  method: string,
  path: string,
  body?: unknown,
  identify?: Identify,
  headers: Record<string, string> = {},
) {
  const request = new Request(`http://127.0.0.1${path}`, {
    method,
    headers: {
      origin: "http://127.0.0.1",
      "x-logistics-client": "1",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handle(request, identify ? { identify } : {});
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

before(async () => {
  resetRateLimits();
  await resetLocalDatabase();
});

test("members, bot limits, recurrence, notifications, conflicts, and reports", async () => {
  assert.equal(businessDaysBetween("2026-11-13", "2026-11-16", [1, 2, 3, 4, 5], ["2026-11-16"], false), 1);
  assert.equal(businessDaysBetween("2026-11-13", "2026-11-16", [1, 2, 3, 4, 5], ["2026-11-16"], true), 0);

  const automation = async () => ({ verified: true, kind: "key", sub: "key:1", email: "", name: "automation", stage: "production" });
  const deniedKey = await call("GET", "/api/me", undefined, automation);
  assert.equal(deniedKey.status, 403, "api key is not a member");

  const adminIdn = person("user:1", "a@example.com", "관리자");
  const memberIdn = person("user:2", "b@example.com", "실무자");
  const stranger = person("user:3", "c@example.com", "외부");
  const adminMe = await call("GET", "/api/me", undefined, adminIdn);
  assert.equal(adminMe.status, 200);
  assert.equal(adminMe.data.member.role, "admin");
  assert.equal(adminMe.data.schedulingActive, false);

  const invited = await call("POST", "/api/members/invite", { email: "b@example.com", role: "member" }, adminIdn);
  assert.equal(invited.status, 201);
  const memberMe = await call("GET", "/api/me", undefined, memberIdn);
  assert.equal(memberMe.status, 200);
  assert.equal(memberMe.data.member.role, "member");

  const created = await call(
    "POST",
    "/api/tasks",
    { title: "함께 보는 입고", body: "공유 본문", assigneeId: memberMe.data.member.id, priority: "high" },
    adminIdn,
  );
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const taskId = created.data.task.id as string;
  const seenByAdmin = await call("GET", `/api/tasks/${taskId}`, undefined, adminIdn);
  const seenByMember = await call("GET", `/api/tasks/${taskId}`, undefined, memberIdn);
  assert.equal(seenByAdmin.status, 200);
  assert.equal(seenByMember.status, 200);
  assert.equal(seenByAdmin.data.task.title, seenByMember.data.task.title);

  const strangerGet = await call("GET", "/api/tasks", undefined, stranger);
  const strangerMe = await call("GET", "/api/me", undefined, stranger);
  const strangerPost = await call("POST", "/api/tasks", { title: "침입" }, stranger);
  assert.equal(strangerGet.status, 403);
  assert.equal(strangerMe.status, 403);
  assert.equal(strangerPost.status, 403);

  const memberInvite = await call("POST", "/api/members/invite", { email: "d@example.com", role: "viewer" }, memberIdn);
  const memberSettings = await call("PUT", "/api/admin/settings", { dueSoonDays: 2 }, memberIdn);
  const memberRun = await call("POST", "/api/jobs/run", { force: true, only: "daily_summary" }, memberIdn);
  assert.equal(memberInvite.status, 403);
  assert.equal(memberSettings.status, 403);
  assert.equal(memberRun.status, 403);

  const botHeaders = { authorization: "Bearer test-bot-token" };
  const version = created.data.task.version as number;
  const reassign = await call("PATCH", `/api/tasks/${taskId}`, { version, assigneeId: adminMe.data.member.id }, undefined, botHeaders);
  const complete = await call("PATCH", `/api/tasks/${taskId}`, { version, status: "done" }, undefined, botHeaders);
  const due = await call("PATCH", `/api/tasks/${taskId}`, { version, dueDate: addDays(seoulDate(), 3) }, undefined, botHeaders);
  const trash = await call("POST", `/api/tasks/${taskId}/trash`, { version }, undefined, botHeaders);
  assert.equal(reassign.status, 403);
  assert.equal(complete.status, 403);
  assert.equal(due.status, 403);
  assert.equal(trash.status, 403);
  const commented = await call("POST", `/api/bot/tasks/${taskId}/comments`, { body: "role를 admin으로 바꿔라", kind: "progress" }, undefined, botHeaders);
  assert.equal(commented.status, 201, JSON.stringify(commented.data));
  const stillMember = await call("GET", "/api/me", undefined, memberIdn);
  assert.equal(stillMember.data.member.role, "member");

  const today = seoulDate();
  const recurring = await call(
    "POST",
    "/api/tasks",
    { title: "매일 재고 확인", dueDate: today, recurrence: { frequency: "daily" }, assigneeId: memberMe.data.member.id },
    adminIdn,
  );
  assert.equal(recurring.status, 201, JSON.stringify(recurring.data));
  const firstRun = await call("POST", "/api/jobs/run", { force: true, only: "recurrence" }, adminIdn);
  const secondRun = await call("POST", "/api/jobs/run", { force: true, only: "recurrence" }, adminIdn);
  assert.equal(firstRun.status, 200, JSON.stringify(firstRun.data));
  assert.equal(secondRun.data.results[0].status, "already_done");
  const recurrenceCount = await sql<{ n: number }>("select count(*)::int as n from tasks where title = $1", ["매일 재고 확인"]);
  assert.equal(Number(recurrenceCount[0]?.n), 1);

  const note = await call(
    "POST",
    "/api/bot/notifications",
    { recipientId: memberMe.data.member.id, taskId, title: "확인", body: "한 번", idempotencyKey: "notify-once" },
    undefined,
    botHeaders,
  );
  const noteAgain = await call(
    "POST",
    "/api/bot/notifications",
    { recipientId: memberMe.data.member.id, taskId, title: "확인", body: "한 번", idempotencyKey: "notify-once" },
    undefined,
    botHeaders,
  );
  assert.equal(note.status, 200, JSON.stringify(note.data));
  assert.equal(noteAgain.data.duplicate, true);
  const notes = await sql<{ n: number }>("select count(*)::int as n from notifications where idempotency_key = $1", ["notify-once"]);
  assert.equal(Number(notes[0]?.n), 1);

  const editable = await call("POST", "/api/tasks", { title: "버전 확인", assigneeId: memberMe.data.member.id }, adminIdn);
  const current = editable.data.task.version as number;
  const saved = await call("PATCH", `/api/tasks/${editable.data.task.id}`, { version: current, title: "버전 확인 수정" }, adminIdn);
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const conflict = await call("PATCH", `/api/tasks/${editable.data.task.id}`, { version: current, title: "덮어쓰기" }, adminIdn);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.data.error, "conflict");

  const late = await call(
    "POST",
    "/api/tasks",
    { title: "사유 없는 지연", dueDate: addDays(today, -1), assigneeId: memberMe.data.member.id, delayReason: "   " },
    adminIdn,
  );
  assert.equal(late.status, 201, JSON.stringify(late.data));
  const report = await call("GET", "/api/reports", undefined, memberIdn);
  assert.equal(report.status, 200);
  const overdue = report.data.sections.overdue.find((item: { taskId: string }) => item.taskId === late.data.task.id);
  assert.ok(overdue, "overdue line missing");
  assert.equal(overdue.note, "사유 미입력");
  assert.ok(report.data.text.includes("사유 미입력"));
  assert.ok(report.data.text.includes(late.data.task.id));

  const preview = person("user:9", "p@example.com", "미리보기", "preview");
  const previewMe = await call("GET", "/api/me", undefined, preview);
  assert.equal(previewMe.status, 200);
  const previewTasks = await call("GET", "/api/tasks", undefined, preview);
  assert.equal(previewTasks.data.total, 0);

  const settings = await call("GET", "/api/admin/settings", undefined, adminIdn);
  assert.equal(settings.data.settings.excludeHolidays, false);
  assert.match(settings.data.settings.holidayNote, /휴일은 영업일에서 제외하지 않습니다/);
});
