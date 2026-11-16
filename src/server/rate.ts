import { createHash } from "node:crypto";
import { sql } from "./db";
import { HttpError } from "./http";

const buckets = new Map<string, number[]>();

export function resetRateLimits(): void {
  buckets.clear();
}

export function consumeMemory(key: string, limit: number, windowMs = 60_000): void {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    throw new HttpError(429, "rate_limited", "요청이 너무 많습니다. 잠시 후 다시 시도하세요.");
  }
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 2000) {
    for (const [name, times] of buckets) {
      if (times.every((stamp) => now - stamp >= windowMs)) buckets.delete(name);
    }
  }
}

export async function consumeDb(key: string, limit: number): Promise<void> {
  await sql("delete from rate_hits where hit_at < now() - interval '10 minutes'");
  await sql("insert into rate_hits (actor_key) values ($1)", [key]);
  const rows = await sql<{ n: number }>(
    "select count(*)::int as n from rate_hits where actor_key = $1 and hit_at > now() - interval '1 minute'",
    [key],
  );
  if (Number(rows[0]?.n ?? 0) > limit) {
    throw new HttpError(429, "rate_limited", "요청이 너무 많습니다. 잠시 후 다시 시도하세요.");
  }
}

export function requestBucket(request: Request): string {
  const authorization = request.headers.get("authorization");
  if (!authorization) return "anon";
  return createHash("sha256").update(authorization).digest("hex").slice(0, 24);
}
