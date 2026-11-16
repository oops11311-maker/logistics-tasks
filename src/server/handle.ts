import { seoulParts } from "../lib/time";
import {
  addCategory,
  exportRealm,
  importRealm,
  inviteMember,
  listMembers,
  runLog,
  mapSettings,
  updateCategory,
  updateMember,
  updateSettings,
} from "./admin";
import { loadSettings, requireMember, requireRole, resolveActor, type Actor, type Identify } from "./auth";
import { sql } from "./db";
import { fail, HttpError, json, nid, readJson, requireClientHeader } from "./http";
import { isJobName, recordBotRun, runJobs, spawnRecurrences } from "./jobs";
import { buildDashboard, buildReport, projectCards, reportCsv, staleTasks } from "./reports";
import { consumeDb, consumeMemory, requestBucket } from "./rate";
import {
  addComment,
  bulkUpdate,
  createTask,
  getTaskDetail,
  insertNotification,
  listCategories,
  listDirectory,
  listNotifications,
  listTasks,
  mapHistory,
  markAllRead,
  markRead,
  restoreTask,
  scopeForBot,
  trashTask,
  unreadCount,
  updateTask,
} from "./tasks";

const MUTATIONS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function match(path: string, pattern: string): Record<string, string> | null {
  const left = path.split("/").filter(Boolean);
  const right = pattern.split("/").filter(Boolean);
  if (left.length !== right.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < left.length; index += 1) {
    if (right[index].startsWith(":")) params[right[index].slice(1)] = decodeURIComponent(left[index]);
    else if (left[index] !== right[index]) return null;
  }
  return params;
}

function queryNumber(url: URL, key: string, fallback: number): number {
  const raw = url.searchParams.get(key);
  if (raw == null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new HttpError(400, "bad_request", "숫자 형식이 올바르지 않습니다.");
  return value;
}

export async function handle(request: Request, options: { identify?: Identify } = {}): Promise<Response> {
  try {
    consumeMemory(requestBucket(request), request.headers.get("authorization") ? 180 : 240);
    const actor = await resolveActor(request, options.identify);
    const actorKey = actor.type === "member" ? actor.member.id : actor.type === "bot" ? `bot:${actor.member.realm}` : `scheduler:${actor.realm}`;
    await consumeDb(`${actorKey}:${new URL(request.url).pathname.startsWith("/api/bot") ? "bot" : "api"}`, 120);
    if (MUTATIONS.has(request.method)) await consumeDb(`${actorKey}:write`, 60);
    if (MUTATIONS.has(request.method) && actor.type === "member") requireClientHeader(request);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    if (request.method === "DELETE") {
      throw new HttpError(405, "no_delete", "작업은 삭제하지 않습니다. 휴지통으로 옮긴 뒤 복원할 수 있습니다.");
    }
    return await route(request, actor, path, url);
  } catch (error) {
    return fail(error);
  }
}

async function route(request: Request, actor: Actor, path: string, url: URL): Promise<Response> {
  if (actor.type === "scheduler" && !(request.method === "POST" && path === "/api/jobs/run")) {
    throw new HttpError(403, "forbidden", "예약 실행 권한으로는 이 작업을 할 수 없습니다.");
  }
  if (actor.type === "bot" && !path.startsWith("/api/bot/")) {
    throw new HttpError(403, "bot_forbidden", "봇은 담당자 변경, 기한 변경, 완료, 삭제를 할 수 없습니다.");
  }
  if (path.startsWith("/api/bot/")) return botRoute(request, actor, path, url);

  const method = request.method;
  if (method === "GET" && path === "/api/me") {
    const { member, simulated } = requireMember(actor);
    const clock = seoulParts();
    const body: Record<string, unknown> = {
      member: { id: member.id, name: member.name, email: member.email, role: member.role },
      simulated,
      today: clock.date,
      timezone: "Asia/Seoul",
      schedulingActive: false,
      unreadNotifications: await unreadCount(member),
    };
    if (member.role === "admin") {
      body.botTokenConfigured = Boolean(process.env.BOT_API_TOKEN?.trim());
      body.schedulerTokenConfigured = Boolean(process.env.SCHEDULER_TOKEN?.trim());
    }
    return json(body);
  }
  if (method === "GET" && path === "/api/dashboard") {
    const { member } = requireMember(actor);
    return json(await buildDashboard(member.id, member.realm));
  }
  if (method === "GET" && path === "/api/tasks") {
    const { member } = requireMember(actor);
    if (url.searchParams.get("trashed") === "1" && member.role === "viewer") {
      throw new HttpError(403, "forbidden", "휴지통을 볼 권한이 없습니다.");
    }
    const result = await listTasks(member.realm, {
      q: url.searchParams.get("q") ?? undefined,
      assignee: url.searchParams.get("assignee") ?? undefined,
      categoryId: url.searchParams.get("category") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      priority: url.searchParams.get("priority") ?? undefined,
      due: url.searchParams.get("due") ?? undefined,
      bucket: url.searchParams.get("bucket") ?? undefined,
      trashed: url.searchParams.get("trashed") === "1",
      dueFrom: url.searchParams.get("dueFrom") ?? undefined,
      dueTo: url.searchParams.get("dueTo") ?? undefined,
      limit: queryNumber(url, "limit", 50),
      offset: queryNumber(url, "offset", 0),
      viewerId: member.id,
    });
    return json(result);
  }
  if (method === "POST" && path === "/api/tasks") {
    const { member } = requireMember(actor);
    return json({ task: await createTask(member, await readJson(request)) }, 201);
  }
  if (method === "POST" && path === "/api/tasks/bulk") {
    const { member } = requireMember(actor);
    const body = await readJson(request);
    return json({ tasks: await bulkUpdate(member, body) });
  }
  const taskId = match(path, "/api/tasks/:id");
  if (taskId && method === "GET") {
    const { member } = requireMember(actor);
    return json(await getTaskDetail(member.realm, taskId.id, null));
  }
  if (taskId && method === "PATCH") {
    const { member } = requireMember(actor);
    return json({ task: await updateTask(member, taskId.id, await readJson(request)) });
  }
  const comment = match(path, "/api/tasks/:id/comments");
  if (comment && method === "POST") {
    const { member } = requireMember(actor);
    return json(await addComment(member, comment.id, await readJson(request), null), 201);
  }
  const trash = match(path, "/api/tasks/:id/trash");
  if (trash && method === "POST") {
    const { member } = requireMember(actor);
    const body = await readJson(request);
    if (typeof body.version !== "number") throw new HttpError(400, "version_required", "버전 번호가 필요합니다.");
    return json({ task: await trashTask(member, trash.id, body.version) });
  }
  const restore = match(path, "/api/tasks/:id/restore");
  if (restore && method === "POST") {
    const { member } = requireMember(actor);
    const body = await readJson(request);
    if (typeof body.version !== "number") throw new HttpError(400, "version_required", "버전 번호가 필요합니다.");
    return json({ task: await restoreTask(member, restore.id, body.version) });
  }
  if (method === "GET" && path === "/api/projects") {
    const { member } = requireMember(actor);
    return json({ projects: await projectCards(member.realm) });
  }
  if (method === "GET" && path === "/api/reports") {
    const { member } = requireMember(actor);
    return json(await buildReport(member.realm));
  }
  if (method === "GET" && path === "/api/reports.csv") {
    const { member } = requireMember(actor);
    const report = await buildReport(member.realm);
    return new Response(reportCsv(report), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=\"logistics-report.csv\"",
        "cache-control": "private, no-store",
      },
    });
  }
  if (method === "GET" && path === "/api/notifications") {
    const { member } = requireMember(actor);
    return json({ notifications: await listNotifications(member) });
  }
  if (method === "POST" && path === "/api/notifications/read-all") {
    const { member } = requireMember(actor);
    await markAllRead(member);
    return json({ ok: true });
  }
  const read = match(path, "/api/notifications/:id/read");
  if (read && method === "POST") {
    const { member } = requireMember(actor);
    await markRead(member, read.id);
    return json({ ok: true });
  }
  if (method === "GET" && path === "/api/categories") {
    const { member } = requireMember(actor);
    return json({ categories: await listCategories(member.realm) });
  }
  if (method === "POST" && path === "/api/categories") {
    const member = requireRole(actor, ["admin", "manager"]);
    const body = await readJson(request);
    return json({ category: await addCategory(member.realm, body.name) }, 201);
  }
  const category = match(path, "/api/categories/:id");
  if (category && method === "PATCH") {
    const member = requireRole(actor, ["admin", "manager"]);
    return json({ category: await updateCategory(member.realm, category.id, await readJson(request)) });
  }
  if (method === "GET" && path === "/api/directory") {
    const { member } = requireMember(actor);
    return json({ people: await listDirectory(member.realm) });
  }
  if (method === "GET" && path === "/api/members") {
    const member = requireRole(actor, ["admin"]);
    return json(await listMembers(member.realm));
  }
  if (method === "POST" && path === "/api/members/invite") {
    const member = requireRole(actor, ["admin"]);
    return json({ invite: await inviteMember(member, await readJson(request)) }, 201);
  }
  const memberPath = match(path, "/api/members/:id");
  if (memberPath && method === "PATCH") {
    const member = requireRole(actor, ["admin"]);
    return json({ member: await updateMember(member, memberPath.id, await readJson(request)) });
  }
  if (path === "/api/admin/settings" && method === "GET") {
    const member = requireRole(actor, ["admin"]);
    return json({ settings: mapSettings(await loadSettings(member.realm)) });
  }
  if (path === "/api/admin/settings" && method === "PUT") {
    const member = requireRole(actor, ["admin"]);
    return json({ settings: await updateSettings(member.realm, await readJson(request)) });
  }
  if (path === "/api/admin/runs" && method === "GET") {
    const member = requireRole(actor, ["admin"]);
    return json(await runLog(member.realm));
  }
  if (path === "/api/admin/export" && method === "GET") {
    const member = requireRole(actor, ["admin"]);
    return json(await exportRealm(member.realm));
  }
  if (path === "/api/admin/import" && method === "POST") {
    const member = requireRole(actor, ["admin"]);
    return json(await importRealm(member.realm, await readJson(request, 2_000_000)));
  }
  if (path === "/api/jobs/run" && method === "POST") {
    const realm = actor.type === "scheduler" ? actor.realm : requireRole(actor, ["admin"]).realm;
    const body = await readJson(request);
    const only = typeof body.only === "string" ? body.only : undefined;
    if (only && !isJobName(only)) throw new HttpError(400, "bad_job", "알 수 없는 작업입니다.");
    return json(await runJobs({ realm, force: body.force === true, only }));
  }
  throw new HttpError(404, "not_found", "없는 주소입니다.");
}

async function botRoute(request: Request, actor: Actor, path: string, url: URL): Promise<Response> {
  if (actor.type !== "bot") throw new HttpError(403, "forbidden", "봇 토큰이 필요합니다.");
  const member = actor.member;
  const scope = await scopeForBot(member.realm);
  const method = request.method;
  if (method === "GET" && path === "/api/bot/tasks") {
    const assignee = url.searchParams.get("assignee") ?? undefined;
    return json(await listTasks(member.realm, {
      q: url.searchParams.get("q") ?? undefined,
      assignee,
      categoryId: url.searchParams.get("category") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      priority: url.searchParams.get("priority") ?? undefined,
      due: url.searchParams.get("due") ?? undefined,
      dueFrom: url.searchParams.get("dueFrom") ?? undefined,
      dueTo: url.searchParams.get("dueTo") ?? undefined,
      limit: queryNumber(url, "limit", 50),
      offset: queryNumber(url, "offset", 0),
      scopeCategoryIds: scope,
    }));
  }
  const one = match(path, "/api/bot/tasks/:id");
  if (one && method === "GET") return json(await getTaskDetail(member.realm, one.id, scope));
  const comment = match(path, "/api/bot/tasks/:id/comments");
  if (comment && method === "POST") {
    return json(await addComment(member, comment.id, await readJson(request), scope), 201);
  }
  if (method === "GET" && path === "/api/bot/due-soon") {
    const days = Number((await loadSettings(member.realm)).due_soon_days ?? 1);
    const { addDays, seoulDate } = await import("../lib/time");
    const target = addDays(seoulDate(), days);
    const result = await listTasks(member.realm, { dueFrom: target, dueTo: target, limit: 100, offset: 0, scopeCategoryIds: scope });
    return json({ ...result, tasks: result.tasks.filter((task) => task.status !== "done") });
  }
  if (method === "GET" && path === "/api/bot/overdue") {
    return json(await listTasks(member.realm, { due: "overdue", limit: 100, offset: 0, scopeCategoryIds: scope }));
  }
  if (method === "GET" && path === "/api/bot/stale") {
    const tasks = (await staleTasks(member.realm)).filter((task) => !scope || scope.includes(task.categoryId));
    return json({ tasks });
  }
  if (method === "GET" && path === "/api/bot/changes") {
    const since = url.searchParams.get("since");
    const params: unknown[] = [member.realm];
    let sinceSql = "";
    if (since) {
      const parsed = new Date(since);
      if (Number.isNaN(parsed.getTime())) throw new HttpError(400, "bad_date", "since 시각이 올바르지 않습니다.");
      params.push(parsed.toISOString());
      sinceSql = ` and h.created_at >= $2`;
    }
    const rows = await sql(
      `select h.id, h.task_id, t.title as task_title, h.actor_id, m.name as actor_name, h.actor_kind,
              h.field, h.old_value, h.new_value, h.created_at
       from task_history h
       join tasks t on t.id = h.task_id
       join members m on m.id = h.actor_id
       where h.realm = $1${sinceSql}
       order by h.created_at desc
       limit 100`,
      params,
    );
    return json({ changes: rows.map(mapHistory) });
  }
  if (method === "POST" && path === "/api/bot/notifications") {
    const body = await readJson(request);
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!idempotencyKey || !title) throw new HttpError(400, "bad_request", "제목과 멱등 키가 필요합니다.");
    let recipientId = typeof body.recipientId === "string" ? body.recipientId : "";
    const taskId = typeof body.taskId === "string" ? body.taskId : null;
    if (!recipientId && taskId) {
      const detail = await getTaskDetail(member.realm, taskId, scope);
      recipientId = detail.task.assigneeId ?? "";
    }
    if (!recipientId) throw new HttpError(400, "bad_request", "알림을 받을 구성원이 없습니다.");
    const result = await insertNotification(sql, {
      realm: member.realm,
      recipientId,
      taskId,
      kind: typeof body.kind === "string" ? body.kind.slice(0, 40) : "bot",
      title: title.slice(0, 120),
      body: text.slice(0, 1000),
      idempotencyKey: idempotencyKey.slice(0, 200),
    });
    return json({ ...result, duplicate: result.duplicate });
  }
  if (method === "POST" && path === "/api/bot/summaries") {
    const body = await readJson(request);
    const period = body.period === "weekly" ? "weekly" : body.period === "daily" ? "daily" : "";
    const periodKey = typeof body.periodKey === "string" ? body.periodKey.trim() : "";
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!period || !periodKey || !text) throw new HttpError(400, "bad_request", "기간, 키, 본문이 필요합니다.");
    const inserted = await sql(
      `insert into summaries (id, realm, period, period_key, body, created_by)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (realm, period, period_key) do nothing
       returning id`,
      [nid(), member.realm, period, periodKey.slice(0, 40), text.slice(0, 20000), member.id],
    );
    return json({ created: inserted.length > 0 });
  }
  if (method === "POST" && path === "/api/bot/runs") {
    return json(await recordBotRun(member.realm, await readJson(request)));
  }
  if (method === "POST" && path === "/api/bot/recurrence") {
    return json(await spawnRecurrences(member.realm));
  }
  throw new HttpError(404, "not_found", "없는 주소입니다.");
}
