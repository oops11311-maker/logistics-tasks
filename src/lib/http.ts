import { sql } from "./db";

export class HttpError extends Error {
  status: number;
  code: string;
  payload?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, payload?: Record<string, unknown>) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

export function text(body: string, status: number, contentType: string): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": contentType,
      "cache-control": "private, no-store",
    },
  });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.length > 100_000) throw new HttpError(413, "too_large", "요청이 너무 큽니다.");
  if (raw.trim() === "") return {};
  try {
    const value = JSON.parse(raw) as unknown;
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      throw new HttpError(400, "invalid_json", "JSON 객체가 필요합니다.");
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "invalid_json", "JSON 형식이 올바르지 않습니다.");
  }
}

export function assertSameOrigin(request: Request): void {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new HttpError(403, "cross_site", "다른 사이트의 요청은 거절했습니다.");
  }
}

export function isId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,80}$/.test(value);
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "23505";
}

export const RATE_LIMIT_ROW_CAP = 128;

export async function rateLimit(key: string, limit: number): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  const rows = await sql<{ count: number }>(
    `insert into rate_limits (actor_key, window_start, count)
     values ($1, $2, 1)
     on conflict (actor_key, window_start)
     do update set count = rate_limits.count + 1
     returning count`,
    [key, windowStart],
  );
  await sql(`delete from rate_limits where window_start < now() - interval '10 minutes'`);
  await sql(
    `delete from rate_limits as target
     using (
       select actor_key, window_start
       from rate_limits
       where actor_key like 'login:user:%' and actor_key <> $1
       order by window_start desc, actor_key asc
       offset $2
     ) as extra
     where target.actor_key = extra.actor_key
       and target.window_start = extra.window_start`,
    [key, RATE_LIMIT_ROW_CAP],
  );
  return Number(rows[0]?.count ?? 0) <= limit;
}

export function queryNumber(value: string | null, fallback: number, max: number): number {
  if (value == null || value === "") return fallback;
  if (!/^\d+$/.test(value)) throw new HttpError(400, "invalid", "숫자 형식이 올바르지 않습니다.");
  const parsed = Number(value);
  if (parsed > max) return max;
  return parsed;
}
