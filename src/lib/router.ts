import {
  assertAdmin,
  botActor,
  archiveCategory,
  createCategory,
  createInvite,
  hasAppToken,
  listCategories,
  listHolidayRows,
  listInvites,
  listPeople,
  loadSettings,
  matchesSecret,
  requestStage,
  saveSettings,
  secretConfigured,
  updateCategory,
  updateMember,
  type Actor,
  type Stage,
} from "./access";
import { adminSetupPassword, adminSetupStatus, assertCsrf, changeOwnPassword, createAccount, login, logout, resetAccountPassword, resolveSession } from "./auth";
import { sql } from "./db";
import { asIso } from "./format";
import {
  assertSameOrigin,
  HttpError,
  isId,
  json,
  queryNumber,
  rateLimit,
  readJson,
} from "./http";
import { botScope, describeJobs, recordExternalRun, runScheduler, saveBotAlert, saveBotSummary } from "./jobs";
import { buildFocus, buildReport } from "./reports";
import {
  addComment,
  bulkUpdate,
  changeLifecycle,
  createProjectPost,
  createTask,
  dashboard,
  getTask,
  listNotifications,
  listTasks,
  markNotifications,
  stopRecurrence,
  syncCursor,
  updateTask,
  type TaskFilters,
} from "./tasks";
import { isValidDate, seoulDate } from "./time";

const STATUSES = new Set(["할 일", "진행 중", "확인 요청", "보류", "완료"]);
const PRIORITIES = new Set(["긴급", "높음", "보통", "낮음"]);
const DUE = new Set(["today", "week", "next", "overdue", "soon", "stale"]);
const BOT_BLOCKED = ["status", "ownerId", "assigneeId", "dueDate", "dueTime", "delete", "deleted"];

function clock(request: Request): Date {
  if (process.env.NODE_ENV === "production" || process.env.CURSOR_APP_ID || process.env.VERCEL) return new Date();
  if (process.env.LOGISTICS_TEST_AUTH === "1") {
    const raw = request.headers.get("x-logistics-test-now");
    if (raw) {
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  return new Date();
}

async function human(request: Request, mutate: boolean): Promise<Awaited<ReturnType<typeof resolveSession>>> {
  const actor = await resolveSession(request);
  if (mutate) {
    assertSameOrigin(request);
    assertCsrf(request, actor);
  }
  const allowed = await rateLimit(`human:${actor.stage}:${actor.memberId}`, 800);
  if (!allowed) throw new HttpError(429, "rate", "요청이 너무 많습니다. 잠시 후 다시 시도하세요.");
  return actor;
}

async function bot(request: Request): Promise<{ actor: Actor; stage: Stage; scope: string[] | null }> {
  if (!secretConfigured("BOT_API_TOKEN")) {
    throw new HttpError(503, "not_configured", "봇 API 토큰이 설정되지 않았습니다.");
  }
  if (!matchesSecret(request.headers.get("x-cursor-app-token"), "BOT_API_TOKEN")) {
    const allowed = await rateLimit("authfail:bot", 30);
    if (!allowed) throw new HttpError(429, "rate", "요청이 너무 많습니다. 잠시 후 다시 시도하세요.");
    throw new HttpError(401, "unauthorized", "봇 인증에 실패했습니다.");
  }
  const stage = await requestStage(request);
  const allowed = await rateLimit(`bot:${stage}`, 800);
  if (!allowed) throw new HttpError(429, "rate", "요청이 너무 많습니다. 잠시 후 다시 시도하세요.");
  const settings = await loadSettings(stage);
  return { actor: await botActor(stage), stage, scope: botScope(settings) };
}

function rejectBotMutation(body: Record<string, unknown>): void {
  if (BOT_BLOCKED.some((key) => key in body)) {
    throw new HttpError(403, "bot_forbidden", "봇은 담당자, 마감, 완료, 삭제를 바꿀 수 없습니다. 제안만 남길 수 있습니다.");
  }
}

function cadenceFilter(url: URL) {
  const kind = url.searchParams.get("kind");
  const kinds = ["once", "daily", "weekly", "monthly", "yearly"] as const;
  if (!kind) return undefined;
  if (!kinds.includes(kind as (typeof kinds)[number])) {
    throw new HttpError(400, "invalid", "반복 구분이 올바르지 않습니다.");
  }
  return kind as (typeof kinds)[number];
}

function filtersFrom(url: URL): TaskFilters {
  const q = url.searchParams.get("q") ?? undefined;
  if (q && q.length > 100) throw new HttpError(400, "invalid", "검색어가 너무 깁니다.");
  const status = url.searchParams.get("status") ?? undefined;
  const priority = url.searchParams.get("priority") ?? undefined;
  const due = url.searchParams.get("due") ?? undefined;
  if (status && !STATUSES.has(status)) throw new HttpError(400, "invalid", "상태 필터가 올바르지 않습니다.");
  if (priority && !PRIORITIES.has(priority)) throw new HttpError(400, "invalid", "우선순위 필터가 올바르지 않습니다.");
  if (due && !DUE.has(due)) throw new HttpError(400, "invalid", "마감 필터가 올바르지 않습니다.");
  const assigneeId = url.searchParams.get("assigneeId") ?? undefined;
  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  if (assigneeId && !isId(assigneeId)) throw new HttpError(400, "invalid", "담당자 필터가 올바르지 않습니다.");
  if (categoryId && !isId(categoryId)) throw new HttpError(400, "invalid", "프로젝트 필터가 올바르지 않습니다.");
  const dueFrom = url.searchParams.get("dueFrom") ?? undefined;
  const dueTo = url.searchParams.get("dueTo") ?? undefined;
  if ((dueFrom && !isValidDate(dueFrom)) || (dueTo && !isValidDate(dueTo))) {
    throw new HttpError(400, "invalid", "기간이 올바르지 않습니다.");
  }
  return {
    q,
    status,
    priority,
    due,
    assigneeId,
    categoryId,
    dueFrom,
    dueTo,
    mine: url.searchParams.get("mine") === "1",
    open: url.searchParams.get("open") === "1",
    trash: url.searchParams.get("trash") === "1",
    kind: cadenceFilter(url),
    sort: url.searchParams.get("sort") === "new" ? "new" : undefined,
    limit: queryNumber(url.searchParams.get("limit"), 50, 100),
    offset: queryNumber(url.searchParams.get("offset"), 0, 5000),
  };
}

async function projectStats(actor: Actor, now: Date) {
  const rows = await sql<{
    id: string;
    name: string;
    total: number;
    done: number;
    overdue: number;
    linked: number;
    latest_title: string | null;
    latest_at: unknown;
    latest_owner: string | null;
  }>(
    `select c.id, c.name,
        count(t.id) filter (where t.deleted_at is null and t.is_template = false)::int as total,
        count(t.id)::int as linked,
        count(t.id) filter (where t.status = '완료' and t.deleted_at is null and t.is_template = false)::int as done,
        count(t.id) filter (
          where t.status <> '완료' and t.deleted_at is null and t.is_template = false and t.due_at < $2::timestamptz
        )::int as overdue,
        (select t2.title from tasks t2
          where t2.category_id = c.id and t2.stage = c.stage and t2.deleted_at is null and t2.is_template = false
          order by t2.created_at desc limit 1) as latest_title,
        (select t2.created_at from tasks t2
          where t2.category_id = c.id and t2.stage = c.stage and t2.deleted_at is null and t2.is_template = false
          order by t2.created_at desc limit 1) as latest_at,
        (select m.name from tasks t2 join members m on m.id = t2.creator_id
          where t2.category_id = c.id and t2.stage = c.stage and t2.deleted_at is null and t2.is_template = false
          order by t2.created_at desc limit 1) as latest_owner
     from categories c
     left join tasks t on t.category_id = c.id and t.stage = c.stage
     where c.stage = $1 and c.archived = false
     group by c.id, c.name, c.sort_order
     order by c.sort_order`,
    [actor.stage, now.toISOString()],
  );
  return rows.map((row) => {
    const total = Number(row.total);
    const done = Number(row.done);
    return {
      id: row.id,
      name: row.name,
      total,
      done,
      overdue: Number(row.overdue),
      linked: Number(row.linked),
      progress: total === 0 ? 0 : done / total,
      latestTitle: row.latest_title,
      latestAt: asIso(row.latest_at),
      latestOwner: row.latest_owner,
    };
  });
}

function integration() {
  return {
    botTokenConfigured: secretConfigured("BOT_API_TOKEN"),
    schedulerTokenConfigured: secretConfigured("SCHEDULER_TOKEN"),
    unattendedScheduling: false,
    schedulingNote: "이 호스트에서 서버 크론 실행은 확인되지 않았습니다. 무인 스케줄은 켜져 있지 않습니다.",
    pushSupported: false,
    pushNote: "푸시 알림은 확인되지 않아 제공하지 않습니다. 알림은 앱 안에만 쌓입니다.",
    backupNote: "Cursor Apps Postgres의 자동 백업과 보관 기간은 확인되지 않았습니다.",
  };
}

async function adminState(actor: Actor, now: Date) {
  assertAdmin(actor);
  const [members, invites, categories, settings, holidays, jobs] = await Promise.all([
    listPeople(actor.stage),
    listInvites(actor.stage),
    listCategories(actor.stage, true),
    loadSettings(actor.stage),
    listHolidayRows(actor.stage),
    describeJobs(actor.stage, now),
  ]);
  const runs = await sql<{
    id: string;
    source: string;
    job_name: string;
    status: string;
    error: string | null;
    started_at: unknown;
    finished_at: unknown;
  }>(
    `select id, source, job_name, status, error, started_at, finished_at
     from job_runs where stage = $1 order by started_at desc limit 40`,
    [actor.stage],
  );
  return {
    members,
    invites: invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      createdAt: asIso(invite.created_at),
      acceptedAt: asIso(invite.accepted_at),
    })),
    categories,
    settings,
    holidays,
    jobs,
    runs: runs.map((run) => ({
      id: run.id,
      source: run.source,
      job: run.job_name,
      status: run.status,
      error: run.error,
      startedAt: asIso(run.started_at),
      finishedAt: asIso(run.finished_at),
    })),
    integration: integration(),
  };
}

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] !== "api") return json({ error: "not_found", message: "없는 주소입니다." }, 404);
    const method = request.method.toUpperCase();
    const path = parts.slice(1);
    const now = clock(request);
    if (path[0] === "health" && method === "GET") return json({ ok: true });
    if (path[0] === "auth" && path[1] === "login" && method === "POST") {
      assertSameOrigin(request);
      return await login(request, await readJson(request));
    }
    if (path[0] === "auth" && path[1] === "admin-setup" && method === "GET") return await adminSetupStatus(request);
    if (path[0] === "auth" && path[1] === "admin-setup" && method === "POST") {
      return await adminSetupPassword(request, await readJson(request));
    }
    if (path[0] === "bot") return await botRoute(request, method, path.slice(1), url, now);
    if (path[0] === "jobs" && path[1] === "webhook") return await webhook(request, now);
    return await humanRoute(request, method, path, url, now);
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.code, message: error.message, ...(error.payload ?? {}) }, error.status);
    }
    if (process.env.LOGISTICS_TEST_AUTH === "1") console.error("api_error", error);
    else console.error("api_error", error instanceof Error ? error.name : "unknown");
    return json({ error: "server", message: "요청을 처리하지 못했습니다." }, 500);
  }
}

async function webhook(request: Request, now: Date): Promise<Response> {
  if (request.method.toUpperCase() !== "POST") return json({ error: "method", message: "POST만 가능합니다." }, 405);
  if (!secretConfigured("SCHEDULER_TOKEN")) {
    return json({ error: "not_configured", message: "스케줄 토큰이 설정되지 않았습니다." }, 503);
  }
  if (!matchesSecret(request.headers.get("x-cursor-app-token"), "SCHEDULER_TOKEN")) {
    return json({ error: "unauthorized", message: "스케줄 인증에 실패했습니다." }, 401);
  }
  const stage = await requestStage(request);
  const allowed = await rateLimit(`scheduler:${stage}`, 60);
  if (!allowed) return json({ error: "rate", message: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." }, 429);
  const key = request.headers.get("idempotency-key");
  if (key && !/^[A-Za-z0-9:_-]{1,80}$/.test(key)) {
    return json({ error: "invalid", message: "멱등 키 형식이 올바르지 않습니다." }, 400);
  }
  if (key) {
    const existing = await sql<{ status: string; detail: unknown }>(
      `select status, detail from job_runs where stage = $1 and idempotency_key = $2 and job_name = 'webhook'`,
      [stage, key],
    );
    if (existing[0] && existing[0].status === "success") {
      return json({ duplicate: true, ...(existing[0].detail as object) });
    }
  }
  const result = await runScheduler(stage, now, "webhook");
  const failed = result.results.some((item) => item.status === "error");
  if (key) {
    await sql(
      `insert into job_runs (id, stage, source, job_name, status, detail, idempotency_key, finished_at)
       values ($1, $2, 'webhook', 'webhook', $3, $4::jsonb, $5, now())
       on conflict (stage, idempotency_key) where idempotency_key is not null
       do update set status = excluded.status, detail = excluded.detail, finished_at = now()`,
      [crypto.randomUUID(), stage, failed ? "error" : "success", JSON.stringify(result), key],
    );
  }
  return json({ ...result, unattendedScheduling: false }, failed ? 500 : 200);
}

async function botRoute(request: Request, method: string, path: string[], url: URL, now: Date): Promise<Response> {
  const auth = await bot(request);
  if (method === "PATCH" || method === "DELETE") {
    const body = method === "DELETE" ? {} : await readJson(request);
    rejectBotMutation(body);
    return json({ error: "bot_forbidden", message: "봇은 업무를 수정하거나 삭제할 수 없습니다. 제안 댓글만 남길 수 있습니다." }, 403);
  }
  if (path[0] === "tasks" && path.length === 1 && method === "GET") {
    const filters = filtersFrom(url);
    filters.categoryScope = auth.scope;
    if (auth.scope && filters.categoryId && !auth.scope.includes(filters.categoryId)) {
      return json({ items: [], total: 0, limit: filters.limit, offset: filters.offset });
    }
    return json(await listTasks(auth.actor, filters, now));
  }
  if (path[0] === "tasks" && path.length === 2 && method === "GET") {
    return json(await getTask(auth.actor, path[1], auth.scope));
  }
  if (path[0] === "changes" && method === "GET") {
    const since = url.searchParams.get("since");
    if (since && Number.isNaN(new Date(since).getTime())) {
      throw new HttpError(400, "invalid", "since 시각이 올바르지 않습니다.");
    }
    const limit = queryNumber(url.searchParams.get("limit"), 50, 100);
    const params: unknown[] = [auth.stage];
    let sinceSql = "";
    if (since) {
      params.push(new Date(since).toISOString());
      sinceSql = ` and e.created_at > $${params.length}::timestamptz`;
    }
    let scopeSql = "";
    if (auth.scope && auth.scope.length > 0) {
      params.push(auth.scope.join(","));
      scopeSql = ` and t.category_id = any(string_to_array($${params.length}, ','))`;
    }
    params.push(limit);
    const rows = await sql<{
      id: string;
      task_id: string;
      title: string;
      action: string;
      field: string | null;
      old_value: string | null;
      new_value: string | null;
      actor_kind: string;
      created_at: unknown;
    }>(
      `select e.id, e.task_id, t.title, e.action, e.field, e.old_value, e.new_value, e.actor_kind, e.created_at
       from task_events e join tasks t on t.id = e.task_id
       where e.stage = $1${sinceSql}${scopeSql}
       order by e.created_at asc
       limit $${params.length}`,
      params,
    );
    return json({
      items: rows.map((row) => ({
        id: row.id,
        taskId: row.task_id,
        href: `/tasks/${row.task_id}`,
        title: row.title,
        action: row.action,
        field: row.field,
        oldValue: row.old_value,
        newValue: row.new_value,
        actorKind: row.actor_kind,
        createdAt: asIso(row.created_at),
      })),
      limit,
    });
  }
  if (method !== "POST") return json({ error: "method", message: "지원하지 않는 요청입니다." }, 405);
  const body = await readJson(request);
  rejectBotMutation(body);
  if (path[0] === "alerts") return json(await saveBotAlert(auth.stage, auth.scope, body));
  if (path[0] === "comments") {
    const taskId = typeof body.taskId === "string" ? body.taskId : "";
    await getTask(auth.actor, taskId, auth.scope);
    const kind = body.kind === "proposal" ? "proposal" : "progress_check";
    const commentId = await addComment(auth.actor, taskId, body, kind);
    return json({ id: commentId, kind });
  }
  if (path[0] === "summaries") return json(await saveBotSummary(auth.stage, body));
  if (path[0] === "runs") return json(await recordExternalRun(auth.stage, body));
  return json({ error: "not_found", message: "없는 주소입니다." }, 404);
}

async function humanRoute(request: Request, method: string, path: string[], url: URL, now: Date): Promise<Response> {
  if (hasAppToken(request)) {
    throw new HttpError(403, "bot_forbidden", "앱 토큰으로는 사람 권한을 쓸 수 없습니다.");
  }
  const mutate = method !== "GET" && method !== "HEAD";
  const actor = await human(request, mutate);
  if (path[0] === "auth" && path[1] === "logout" && method === "POST") return logout(actor, request);
  if (path[0] === "auth" && path[1] === "password" && method === "POST") return changeOwnPassword(actor, await readJson(request));
  if (actor.mustChangePassword) {
    throw new HttpError(403, "password_change_required", "비밀번호를 먼저 바꾸세요.", { csrfToken: actor.csrfToken });
  }
  if (path[0] === "bootstrap" && method === "GET") {
    const [categories, people, notes] = await Promise.all([
      listCategories(actor.stage, false),
      listPeople(actor.stage),
      listNotifications(actor),
    ]);
    return json({
      me: { id: actor.memberId, name: actor.name, email: actor.email, role: actor.role },
      csrfToken: actor.csrfToken,
      categories,
      members: people.filter((person) => person.active),
      notifications: notes,
      today: seoulDate(now),
      timezone: "Asia/Seoul",
      unattendedScheduling: false,
    });
  }
  if (path[0] === "dashboard" && method === "GET") {
    const data = await dashboard(actor, now);
    const warnings = actor.role === "admin" ? (await describeJobs(actor.stage, now)).filter((job) => job.warning) : [];
    return json({ ...data, warnings });
  }
  if (path[0] === "sync" && method === "GET") {
    return json({ cursor: await syncCursor(actor) });
  }
  if (path[0] === "projects" && path.length === 1 && method === "GET") return json({ items: await projectStats(actor, now) });
  if (path[0] === "projects" && path[1] && path[2] === "posts" && method === "POST") {
    return json(await createProjectPost(actor, path[1], await readJson(request), now), 201);
  }
  if (path[0] === "projects" && path[1] && method === "GET") {
    if (!isId(path[1])) return json({ error: "not_found", message: "프로젝트를 찾지 못했습니다." }, 404);
    const boards = await projectStats(actor, now);
    const project = boards.find((item) => item.id === path[1]);
    if (!project) return json({ error: "not_found", message: "프로젝트를 찾지 못했습니다." }, 404);
    const posts = await listTasks(actor, {
      categoryId: path[1],
      limit: 100,
      offset: 0,
      sort: "new",
    }, now);
    return json({ project, posts: posts.items });
  }
  if (path[0] === "focus" && method === "GET") {
    if (actor.role === "bot") throw new HttpError(403, "forbidden", "효율을 볼 권한이 없습니다.");
    return json(await buildFocus(actor, now));
  }
  if (path[0] === "reports" && method === "GET") {
    if (actor.role === "bot") throw new HttpError(403, "forbidden", "보고서를 볼 권한이 없습니다.");
    const report = await buildReport(actor, now);
    if (url.searchParams.get("format") === "csv") {
      return new Response(`\uFEFF${report.csv}`, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": "attachment; filename=\"report.csv\"",
          "cache-control": "private, no-store",
        },
      });
    }
    return json(report);
  }
  if (path[0] === "notifications" && method === "GET") return json(await listNotifications(actor));
  if (path[0] === "notifications" && path[1] === "read" && method === "POST") {
    await markNotifications(actor, await readJson(request));
    return json({ ok: true });
  }
  if (path[0] === "tasks" && path.length === 1 && method === "GET") {
    return json(await listTasks(actor, filtersFrom(url), now));
  }
  if (path[0] === "tasks" && path.length === 1 && method === "POST") {
    return json(await createTask(actor, await readJson(request), now), 201);
  }
  if (path[0] === "tasks" && path[1] === "bulk" && method === "POST") {
    return json(await bulkUpdate(actor, await readJson(request), now));
  }
  if (path[0] === "tasks" && path.length === 2 && method === "GET") return json(await getTask(actor, path[1]));
  if (path[0] === "tasks" && path.length === 2 && method === "PATCH") {
    return json(await updateTask(actor, path[1], await readJson(request), now));
  }
  if (path[0] === "tasks" && path[2] === "comments" && method === "POST") {
    const commentId = await addComment(actor, path[1], await readJson(request), "comment");
    return json({ id: commentId }, 201);
  }
  if (path[0] === "tasks" && method === "POST" && path[2] && ["complete", "reopen", "trash", "restore"].includes(path[2])) {
    return json(await changeLifecycle(actor, path[1], path[2] as "complete" | "reopen" | "trash" | "restore", await readJson(request), now));
  }
  if (path[0] === "tasks" && path[2] === "recurrence" && path[3] === "stop" && method === "POST") {
    await stopRecurrence(actor, path[1]);
    return json(await getTask(actor, path[1]));
  }
  if (path[0] === "categories" && method === "GET") return json({ items: await listCategories(actor.stage, false) });
  if (path[0] === "categories" && method === "POST") return json(await createCategory(actor, await readJson(request)), 201);
  if (path[0] === "categories" && path[1] && method === "PATCH") {
    await updateCategory(actor, path[1], await readJson(request));
    return json({ ok: true });
  }
  if (path[0] === "categories" && path[1] && method === "DELETE") {
    return json(await archiveCategory(actor, path[1]));
  }
  if (path[0] === "admin") return adminRoute(actor, method, path.slice(1), request, now);
  return json({ error: "not_found", message: "없는 주소입니다." }, 404);
}

async function adminRoute(actor: Actor, method: string, path: string[], request: Request, now: Date): Promise<Response> {
  if (path[0] === "state" && method === "GET") return json(await adminState(actor, now));
  if (path[0] === "accounts" && path[1] && path[2] === "password" && method === "POST") {
    await resetAccountPassword(actor, path[1], await readJson(request));
    return json({ ok: true });
  }
  if (path[0] === "accounts" && path.length === 1 && method === "POST") return json(await createAccount(actor, await readJson(request)), 201);
  if (path[0] === "invites" && method === "POST") return json(await createInvite(actor, await readJson(request)), 201);
  if (path[0] === "members" && path[1] && method === "PATCH") {
    await updateMember(actor, path[1], await readJson(request));
    return json({ ok: true });
  }
  if (path[0] === "categories" && method === "POST") return json(await createCategory(actor, await readJson(request)), 201);
  if (path[0] === "categories" && path[1] && method === "PATCH") {
    await updateCategory(actor, path[1], await readJson(request));
    return json({ ok: true });
  }
  if (path[0] === "settings" && method === "PUT") return json(await saveSettings(actor, await readJson(request)));
  if (path[0] === "jobs" && path[1] === "run" && method === "POST") {
    assertAdmin(actor);
    const result = await runScheduler(actor.stage, now, "manual");
    return json({ ...result, unattendedScheduling: false });
  }
  return json({ error: "not_found", message: "없는 주소입니다." }, 404);
}
