"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, formatWhen, type Task } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

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

export default function DashboardPage() {
  const { revision } = useApp();
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError("");
    api<Dash>("/api/dashboard")
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [revision]);

  if (loading && !data) return <State kind="loading">불러오는 중…</State>;
  if (error) return <State kind="error" onRetry={load}>{error}</State>;
  if (!data) return <State kind="empty">표시할 내용이 없습니다.</State>;

  return (
    <div className="list">
      {data.warnings.length > 0 ? (
        <div className="banner bad">{data.warnings.map((warning) => warning.warningText).join(" ")}</div>
      ) : null}
      <div className="cards-4">
        <Link className="panel stat" href="/my"><b>{data.today.length}</b><span>오늘 마감</span></Link>
        <Link className="panel stat" href="/team?due=overdue"><b>{data.overdue.length}</b><span>내 지연</span></Link>
        <Link className="panel stat" href="/my"><b>{data.week.length}</b><span>이번 주</span></Link>
        <Link className="panel stat" href={`/team?status=${encodeURIComponent("확인 요청")}`}><b>{data.review.length}</b><span>확인 요청</span></Link>
      </div>
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
    </div>
  );
}
