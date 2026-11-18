"use client";

import { useEffect, useState } from "react";
import { type Dash } from "@/app/dashboard-type";
import { DashboardSections } from "@/app/dashboard-sections";
import { DashboardStats } from "@/app/dashboard-stats";
import { api } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

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
      <DashboardStats today={data.today.length} overdue={data.overdue.length} week={data.week.length} review={data.review.length} />
      <DashboardSections data={data} />
    </div>
  );
}
