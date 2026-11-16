export const STATUSES = [
  { id: "todo", label: "할 일" },
  { id: "in_progress", label: "진행 중" },
  { id: "review", label: "확인 요청" },
  { id: "hold", label: "보류" },
  { id: "done", label: "완료" },
] as const;

export const PRIORITIES = [
  { id: "urgent", label: "긴급" },
  { id: "high", label: "높음" },
  { id: "normal", label: "보통" },
  { id: "low", label: "낮음" },
] as const;

export const ROLES = [
  { id: "admin", label: "관리자" },
  { id: "manager", label: "매니저" },
  { id: "member", label: "멤버" },
  { id: "viewer", label: "뷰어" },
] as const;

export const FREQUENCIES = [
  { id: "daily", label: "매일" },
  { id: "weekly", label: "매주" },
  { id: "monthly", label: "매월" },
] as const;

export type StatusId = (typeof STATUSES)[number]["id"];
export type PriorityId = (typeof PRIORITIES)[number]["id"];
export type HumanRole = (typeof ROLES)[number]["id"];
export type Frequency = (typeof FREQUENCIES)[number]["id"];

export function statusLabel(id: string): string {
  return STATUSES.find((item) => item.id === id)?.label ?? id;
}

export function priorityLabel(id: string): string {
  return PRIORITIES.find((item) => item.id === id)?.label ?? id;
}

export function roleLabel(id: string): string {
  if (id === "bot") return "봇";
  return ROLES.find((item) => item.id === id)?.label ?? id;
}

export function frequencyLabel(id: string): string {
  return FREQUENCIES.find((item) => item.id === id)?.label ?? id;
}

export const JOBS = [
  { id: "daily_summary", label: "오늘·기한 지남 요약" },
  { id: "due_soon", label: "마감 전 알림" },
  { id: "overdue", label: "기한 지남 알림" },
  { id: "stale_checkin", label: "진행 정체 확인" },
  { id: "weekly_draft", label: "주간 보고 초안" },
  { id: "recurrence", label: "반복 작업 생성" },
] as const;

export function jobLabel(id: string): string {
  return JOBS.find((item) => item.id === id)?.label ?? id;
}
