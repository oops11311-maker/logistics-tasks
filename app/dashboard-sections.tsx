"use client";

import Link from "next/link";
import { formatWhen, type Task } from "@/components/api";

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
      <section className="panel">
        <h2>봇 요약</h2>
        {data.summary ? <pre className="copy">{data.summary.body}</pre> : <p className="state">아직 봇 요약이 없습니다. 관리 화면에서 실행하거나 웹훅을 호출하세요. 무인 스케줄은 켜져 있지 않습니다.</p>}
        <h2>알림</h2>
        {data.alerts.length === 0 ? <p className="state">알림이 없습니다.</p> : data.alerts.map((alert) => (
          <div key={alert.id} className="item">
            {alert.href ? <Link href={alert.href}>{alert.title ?? alert.body}</Link> : <span>{alert.body}</span>}
            <span className="sub">{formatWhen(alert.createdAt)}</span>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>담당자별</h2>
        {data.byAssignee.length === 0 ? <p className="state">멤버가 없습니다.</p> : data.byAssignee.map((row) => (
          <Link key={row.id} href={`/team?assigneeId=${row.id}`} className="item">
            <span>{row.name}</span>
            <span className="sub">진행 {row.open} · 지연 {row.overdue}</span>
          </Link>
        ))}
        <h2>최근 변경</h2>
        {data.recent.length === 0 ? <p className="state">변경이 없습니다.</p> : data.recent.map((row) => (
          <Link key={row.id} href={row.href} className="item">
            <span>{row.title}</span>
            <span className="sub">{row.actorName} · {row.actorKind === "bot" ? "봇" : "사람"} · {formatWhen(row.createdAt)}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
