"use client";

import { useEffect, useState } from "react";
import { AccountSection } from "@/app/admin/accounts";
import { RunsSection } from "@/app/admin/runs";
import { ScheduleSection } from "@/app/admin/schedule";
import { type AdminState } from "@/app/admin/types";
import { api } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

export default function AdminPage() {
  const { me, online, toast, reload } = useApp();
  const [data, setData] = useState<AdminState | null>(null);
  const [error, setError] = useState("");

  function load() {
    api<AdminState>("/api/admin/state").then(setData).catch((reason: Error) => setError(reason.message));
  }

  useEffect(() => {
    if (me.role === "admin") load();
  }, [me.role]);

  if (me.role !== "admin") return <State kind="error">관리자만 이 화면을 볼 수 있습니다.</State>;
  if (error) return <State kind="error" onRetry={load}>{error}</State>;
  if (!data) return <State kind="loading">불러오는 중…</State>;

  return (
    <div className="list">
      <AccountSection data={data} meId={me.id} online={online} toast={toast} reload={load} />
      <ScheduleSection data={data} online={online} toast={toast} onData={setData} reload={load} />
      <RunsSection data={data} online={online} toast={toast} reload={() => { load(); reload(); }} />
    </div>
  );
}
