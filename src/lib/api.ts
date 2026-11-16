export class ApiError extends Error {
  status: number;
  code: string;
  payload: Record<string, unknown> | null;

  constructor(message: string, status: number, code: string, payload: Record<string, unknown> | null = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        "x-logistics-client": "1",
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("네트워크에 연결할 수 없습니다.", 0, "offline");
  }
  const text = await response.text();
  let data: Record<string, unknown> | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    throw new ApiError(
      typeof data?.message === "string" ? data.message : "요청에 실패했습니다.",
      response.status,
      typeof data?.error === "string" ? data.error : "error",
      data,
    );
  }
  return data as T;
}

export type Person = { id: string; name: string; email?: string; role: string };
export type Me = {
  member: Person & { email: string };
  simulated: boolean;
  today: string;
  timezone: string;
  schedulingActive: boolean;
  unreadNotifications: number;
  botTokenConfigured?: boolean;
  schedulerTokenConfigured?: boolean;
};

export type Task = {
  id: string;
  title: string;
  body: string;
  categoryId: string;
  categoryName: string;
  assigneeId: string | null;
  assigneeName: string;
  creatorId: string;
  creatorName: string;
  collaboratorIds: string[];
  startDate: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: string;
  status: string;
  holdReason: string;
  delayReason: string;
  tags: string[];
  relatedUrls: { label: string; url: string }[];
  checklist: { id: string; text: string; done: boolean }[];
  version: number;
  trashedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  recurrenceRuleId: string | null;
  overdue: boolean;
};

export function dueLabel(task: { dueDate: string | null; dueTime: string | null }): string {
  if (!task.dueDate) return "기한 없음";
  return task.dueTime ? `${task.dueDate} ${task.dueTime}` : `${task.dueDate} 23:59`;
}
