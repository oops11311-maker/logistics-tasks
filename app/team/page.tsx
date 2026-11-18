"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { applyBulk, BulkBar } from "@/app/team/bulk";
import { TeamFilters } from "@/app/team/filters";
import { TeamCalendar, TeamKanban, TeamList } from "@/app/team/views";
import { api, canWrite, type Task } from "@/components/api";
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

  const query = useMemo(() => {
    const next = new URLSearchParams();
    for (const key of ["q", "assigneeId", "categoryId", "status", "priority", "due", "kind"]) {
      const value = params.get(key);
      if (value) next.set(key, value);
    }
    if (view === "calendar") {
      const [year, mon] = month.split("-").map(Number);
      const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
      next.set("dueFrom", `${month}-01`);
      next.set("dueTo", `${month}-${String(last).padStart(2, "0")}`);
      next.delete("due");
    }
    next.set("limit", "100");
    return next.toString();
  }, [params, view, month]);

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
    <div>
      <div className="tabs">
        {[["list", "목록"], ["kanban", "상태별 보기"], ["calendar", "달력"]].map(([key, label]) => (
          <button key={key} className={view === key ? "tab on" : "tab"} onClick={() => setParam("view", key)}>{label}</button>
        ))}
      </div>
      <TeamFilters
        q={params.get("q") ?? ""}
        assigneeId={params.get("assigneeId") ?? ""}
        categoryId={params.get("categoryId") ?? ""}
        status={params.get("status") ?? ""}
        priority={params.get("priority") ?? ""}
        kind={params.get("kind") ?? ""}
        due={params.get("due") ?? ""}
        categories={categories}
        members={members}
        onParam={setParam}
      />
      {selected.size > 0 && canWrite(me.role) ? (
        <BulkBar
          role={me.role}
          online={online}
          members={members}
          bulkStatus={bulkStatus}
          bulkOwner={bulkOwner}
          onStatus={setBulkStatus}
          onOwner={setBulkOwner}
          onApply={(kind) => void applyBulk({
            kind, items, selected, bulkStatus, bulkOwner, online, toast, reload, clear: () => setSelected(new Set()),
          })}
        />
      ) : null}
      {loading ? <State kind="loading">불러오는 중…</State> : error ? <State kind="error" onRetry={load}>{error}</State> : view === "kanban" ? (
        <TeamKanban items={items} role={me.role} online={online} toast={toast} reload={reload} />
      ) : view === "calendar" ? (
        <TeamCalendar month={month} items={items} onMonth={(next) => setParam("month", next)} />
      ) : (
        <TeamList
          items={items}
          role={me.role}
          online={online}
          toast={toast}
          reload={reload}
          selected={selected}
          onSelect={(id, checked) => setSelected((current) => {
            const next = new Set(current);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
          })}
        />
      )}
    </div>
  );
}

export default function TeamPage() {
  return <Suspense fallback={<State kind="loading">불러오는 중…</State>}><TeamInner /></Suspense>;
}
