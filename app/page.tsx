"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardSections } from "@/app/dashboard-sections";
import { api, type Task } from "@/components/api";
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
      <DashboardSections data={data} />
    </div>
  );
}
