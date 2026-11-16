export class HttpError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;

  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "private, no-store",
      ...extraHeaders,
    },
  });
}

export function fail(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: error.code, message: error.message, ...error.extra }, error.status);
  }
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  if (code && !/token|secret|postgres:\/\//i.test(code)) {
    console.error("request_failed", code);
  } else {
    console.error("request_failed");
  }
  return json({ error: "server_error", message: "처리하지 못했습니다. 다시 시도하세요." }, 500);
}

export async function readJson(request: Request, max = 200_000): Promise<Record<string, unknown>> {
  const claimed = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(claimed) && claimed > max) {
    throw new HttpError(413, "too_large", "요청이 너무 큽니다.");
  }
  const text = await request.text();
  if (text.length > max) throw new HttpError(413, "too_large", "요청이 너무 큽니다.");
  if (text.trim() === "") return {};
  try {
    const value = JSON.parse(text) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new HttpError(400, "bad_request", "JSON 객체가 필요합니다.");
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "bad_request", "JSON 형식이 올바르지 않습니다.");
  }
}

export function textOf(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function textOrNull(value: unknown): string | null {
  const text = textOf(value);
  return text === "" ? null : text;
}

export function boolOf(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1;
}

export function numOf(value: unknown): number {
  return Number(value);
}

export function jsonOf<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export function nid(): string {
  return crypto.randomUUID();
}

export function sameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, "bad_origin", "요청 출처를 확인할 수 없습니다.");
  }
  const allowed = new Set(
    [new URL(request.url).host, request.headers.get("host") ?? "", request.headers.get("x-forwarded-host") ?? ""].filter(Boolean),
  );
  if (!allowed.has(originHost)) {
    throw new HttpError(403, "bad_origin", "다른 사이트의 요청은 거절했습니다.");
  }
}

export function requireClientHeader(request: Request): void {
  if (request.headers.get("x-logistics-client") !== "1") {
    throw new HttpError(403, "bad_client", "앱 화면에서만 바꿀 수 있습니다.");
  }
  sameOrigin(request);
}
