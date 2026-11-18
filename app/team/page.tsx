"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { teamQuery } from "@/app/team/team-query";
import { TeamScreen } from "@/app/team/team-screen";
import { api, type Task } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

function TeamInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { categories, members, revision, me, online, toast, reload } = useApp();
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("진행 중");
  const [bulkOwner, setBulkOwner] = useState("");
  const view = params.get("view") ?? "list";
  const month = params.get("month") ?? new Date().toISOString().slice(0, 7);

  const query = useMemo(() => teamQuery(params, view, month), [params, view, month]);

  function load() {
    setLoading(true);
    setError("");
    api<{ items: Task[] }>(`/api/tasks?${query}`)
      .then((data) => setItems(data.items))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [query, revision]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/team?${next.toString()}`);
  }

  return (
    <TeamScreen
      params={params}
      view={view}
      month={month}
      categories={categories}
      members={members}
      selected={selected}
      items={items}
      role={me.role}
      online={online}
      loading={loading}
      error={error}
      bulkStatus={bulkStatus}
      bulkOwner={bulkOwner}
      toast={toast}
      reload={reload}
      onParam={setParam}
      onStatus={setBulkStatus}
      onOwner={setBulkOwner}
      onClear={() => setSelected(new Set())}
      onRetry={load}
      onMonth={(next) => setParam("month", next)}
      onSelect={(id, checked) => setSelected((current) => {
        const next = new Set(current);
        if (checked) next.add(id);
        else next.delete(id);
        return next;
      })}
    />
  );
}

export default function TeamPage() {
  return <Suspense fallback={<State kind="loading">불러오는 중…</State>}><TeamInner /></Suspense>;
}
