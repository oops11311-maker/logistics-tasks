import { type Task } from "@/components/api";

export type Dash = {
  today: Task[];
  overdue: Task[];
  week: Task[];
  review: Task[];
  byAssignee: { id: string; name: string; open: number; overdue: number }[];
  recent: { id: string; href: string; title: string; action: string; actorName: string; actorKind: string; createdAt: string | null }[];
  summary: { body: string; createdAt: string | null; periodKey: string } | null;
  alerts: { id: string; href: string | null; title: string | null; body: string; createdAt: string | null }[];
  warnings: { job: string; warningText: string }[];
};
