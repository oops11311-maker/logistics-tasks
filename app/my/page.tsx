"use client";

import { useEffect, useState } from "react";
import { api, canWrite, PRIORITIES, type Task } from "@/components/api";
import { changeStatus, State, TaskTables } from "@/components/bits";
import { useApp } from "@/components/shell";

const TABS = [
  ["today", "오늘"],
  ["week", "이번 주"],
  ["all", "전체"],
  ["done", "완료"],
] as const;

export default function MyPage() {
  const { categories, revision, toast, online, me, reload } = useApp();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("today");
  const [daily, setDaily] = useState<Task[]>([]);
  const [once, setOnce] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("보통");
  const [kind, setKind] = useState<"daily" | "once">("once");

  function load() {
    const query = tab === "today" ? "mine=1&open=1&due=today" : tab === "week" ? "mine=1&open=1&due=week" : tab === "done" ? "mine=1&status=완료" : "mine=1&open=1";
    setLoading(true);
    setError("");
    Promise.all([
      api<{ items: Task[] }>(`/api/tasks?${query}&kind=daily&limit=100`),
      api<{ items: Task[] }>(`/api/tasks?${query}&kind=once&limit=100`),
    ])
      .then(([dailyRows, onceRows]) => {
        setDaily(dailyRows.items);
        setOnce(onceRows.items);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [tab, revision]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      await api("/api/tasks", {
        method: "POST",
        mutate: true,
        body: JSON.stringify({ title, dueDate: due || null, categoryId: categoryId || null, priority, workKind: kind }),
      });
      setTitle("");
      toast("저장했습니다.");
      load();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
    }
  }

  return (
    <div>
      {canWrite(me.role) ? (
        <form className="filters" onSubmit={(event) => void add(event)}>
          <input className="field grow" aria-label="제목" placeholder="빠른 추가" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <input className="field" aria-label="마감일" type="date" value={due} onChange={(event) => setDue(event.target.value)} />
          <select className="control" aria-label="프로젝트" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">프로젝트</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select className="control" aria-label="우선순위" value={priority} onChange={(event) => setPriority(event.target.value)}>
            {PRIORITIES.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="control" aria-label="업무 구분" value={kind} onChange={(event) => setKind(event.target.value as "daily" | "once")}>
            <option value="once">1회성</option>
            <option value="daily">데일리</option>
          </select>
          <button className="btn primary mutate" disabled={!online}>추가</button>
        </form>
      ) : null}
      <div className="tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? "tab on" : "tab"} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {loading ? <State kind="loading">불러오는 중…</State> : error ? <State kind="error" onRetry={load}>{error}</State> : (
        <div className="boards">
          <section className="panel">
            <h2>데일리업무 {daily.length}</h2>
            <TaskTables items={daily} writable={canWrite(me.role)} onStatus={(task, status) => void changeStatus(task, status, online, toast, () => { reload(); load(); })} />
          </section>
          <section className="panel">
            <h2>1회성 업무 {once.length}</h2>
            <TaskTables items={once} writable={canWrite(me.role)} onStatus={(task, status) => void changeStatus(task, status, online, toast, () => { reload(); load(); })} />
          </section>
        </div>
      )}
    </div>
  );
}
