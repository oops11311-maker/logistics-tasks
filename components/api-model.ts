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
  workKind: "once" | "daily" | "weekly" | "monthly" | "yearly";
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
export const CADENCES = [
  ["once", "1회성"],
  ["daily", "매일"],
  ["weekly", "매주"],
  ["monthly", "매월"],
  ["yearly", "매년"],
] as const;

export function cadenceLabel(value: string): string {
  return CADENCES.find((item) => item[0] === value)?.[1] ?? "1회성";
}

