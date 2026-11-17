"use client";

import { useEffect, useState } from "react";
import { api, CADENCES, canWrite, PRIORITIES, type Task } from "@/components/api";
import { changeCadence, changeStatus, State, TaskTables } from "@/components/bits";
import { useApp } from "@/components/shell";

const TABS = [
  ["today", "오늘"],
  ["week", "이번 주"],
  ["all", "전체"],
  ["done", "완료"],
] as const;

export default function MyPage() {
  const { categories, revision, toast, online, me, reload } = useApp();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("all");
  const [kind, setKind] = useState("");
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("보통");
  const [addKind, setAddKind] = useState("once");

  function load() {
    const query = tab === "today" ? "mine=1&open=1&due=today" : tab === "week" ? "mine=1&open=1&due=week" : tab === "done" ? "mine=1&status=완료" : "mine=1&open=1";
    setLoading(true);
    setError("");
    api<{ items: Task[] }>(`/api/tasks?${query}${kind ? `&kind=${kind}` : ""}&limit=100`)
      .then((data) => setItems(data.items))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [tab, kind, revision]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    if (addKind !== "once" && !due) return toast("반복 업무에는 마감일이 필요합니다.");
    try {
      await api("/api/tasks", {
        method: "POST",
        mutate: true,
        body: JSON.stringify({ title, dueDate: due || null, categoryId: categoryId || null, priority, workKind: addKind }),
      });
      setTitle("");
      toast("저장했습니다.");
      load();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
    }
  }

  const refresh = () => { reload(); load(); };

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
          <select className="control" aria-label="반복" value={addKind} onChange={(event) => setAddKind(event.target.value)}>
            {CADENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="btn primary mutate" disabled={!online}>추가</button>
        </form>
      ) : null}
      <div className="tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? "tab on" : "tab"} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      <div className="tabs">
        <button className={kind === "" ? "tab on" : "tab"} onClick={() => setKind("")}>반복 전체</button>
        {CADENCES.map(([value, label]) => (
          <button key={value} className={kind === value ? "tab on" : "tab"} onClick={() => setKind(value)}>{label}</button>
        ))}
      </div>
      <p className="hint">목록의 반복 칸에서 1회성, 매일, 매주, 매월, 매년을 지정합니다. 반복으로 바꾸면 다음 회차부터 같은 업무가 생기고, 1회성으로 바꾸면 다음 회차는 생기지 않습니다.</p>
      {loading ? <State kind="loading">불러오는 중…</State> : error ? <State kind="error" onRetry={load}>{error}</State> : (
        <TaskTables
          items={items}
          writable={canWrite(me.role)}
          onStatus={(task, status) => void changeStatus(task, status, online, toast, refresh)}
          onCadence={(task, cadence) => void changeCadence(task, cadence, online, toast, refresh)}
        />
      )}
    </div>
  );
}
