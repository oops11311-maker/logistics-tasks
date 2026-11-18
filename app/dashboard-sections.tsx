"use client";

import { type Task } from "@/components/api";
import { DashboardPeople } from "@/app/dashboard-people";
import { DashboardSummary } from "@/app/dashboard-summary";

type Dash = {
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

export function DashboardSections({ data }: { data: Dash }) {
  return (
    <div className="cards-2">
      <DashboardSummary summary={data.summary} alerts={data.alerts} />
      <DashboardPeople byAssignee={data.byAssignee} recent={data.recent} />
    </div>
  );
}
