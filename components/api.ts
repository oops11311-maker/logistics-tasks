export type Person = { id: string; name: string; email: string; role?: string; active?: boolean };
export type Category = { id: string; name: string; sort_order?: number; archived?: boolean };
export type CheckItem = { id: string; text: string; done: boolean };
export type TaskLink = { url: string; label: string };
export type Task = {
  id: string;
  href: string;
  title: string;
  body: string;
  categoryId: string | null;
  categoryName: string | null;
  owner: { id: string; name: string; email: string };
  collaborators: { id: string; name: string; email: string }[];
  creator: { id: string; name: string };
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  dueAt: string | null;
  priority: string;
  status: string;
  checklist: CheckItem[];
  tags: string[];
  links: TaskLink[];
  holdReason: string | null;
  delayReason: string | null;
  version: number;
  deletedAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  overdue: boolean;
  recurring: boolean;
  recurrence: null | {
    freq: string;
    interval: number;
    businessDaysOnly: boolean;
    until: string | null;
    nextRunOn: string | null;
    active: boolean;
  };
};

export const STATUSES = ["할 일", "진행 중", "확인 요청", "보류", "완료"] as const;
export const PRIORITIES = ["긴급", "높음", "보통", "낮음"] as const;

export class ApiError extends Error {
  status: number;
  payload: Record<string, unknown> | null;

  constructor(status: number, message: string, payload: Record<string, unknown> | null) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export async function api<T>(path: string, init: RequestInit & { mutate?: boolean } = {}): Promise<T> {
  if (init.mutate && typeof navigator !== "undefined" && !navigator.onLine) {
    throw new ApiError(0, "오프라인 상태에서는 편집할 수 없습니다.", null);
  }
  const headers = new Headers(init.headers);
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

export function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function roleLabel(role: string): string {
  if (role === "admin") return "관리자";
  if (role === "manager") return "매니저";
  if (role === "member") return "멤버";
  if (role === "viewer") return "뷰어";
  return role;
}

export function canWrite(role: string): boolean {
  return role === "admin" || role === "manager" || role === "member";
}
