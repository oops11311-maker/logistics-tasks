export { CADENCES, PRIORITIES, STATUSES, cadenceLabel, type Category, type CheckItem, type Person, type Task, type TaskLink } from "./api-model";

export class ApiError extends Error {
  status: number;
  payload: Record<string, unknown> | null;

  constructor(status: number, message: string, payload: Record<string, unknown> | null) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

let csrfToken = "";

export function setCsrf(token: string): void {
  csrfToken = token;
}

export async function api<T>(path: string, init: RequestInit & { mutate?: boolean } = {}): Promise<T> {
  if (init.mutate && typeof navigator !== "undefined" && !navigator.onLine) {
    throw new ApiError(0, "오프라인 상태에서는 편집할 수 없습니다.", null);
  }
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && csrfToken) headers.set("x-csrf-token", csrfToken);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError(0, "네트워크에 연결하지 못했습니다.", null);
  }
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const message = typeof payload?.message === "string" ? payload.message : "요청에 실패했습니다.";
    throw new ApiError(response.status, message, payload);
  }
  return data as T;
}

export { canWrite, formatWhen, roleLabel } from "./labels";
