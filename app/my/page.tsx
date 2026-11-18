"use client";

import { useEffect, useState } from "react";
import { addMine } from "@/app/my/my-add";
import { MyToolbar, type MyTab } from "@/app/my/toolbar";
import { api, canWrite, type Task } from "@/components/api";
import { changeCadence, changeStatus, State, TaskTables } from "@/components/bits";
import { useApp } from "@/components/shell";

export default function MyPage() {
  const { categories, revision, toast, online, me, reload } = useApp();
  const [tab, setTab] = useState<MyTab>("all");
  const [kind, setKind] = useState("");
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priority, setPriority] = useState("보통");
  const [addKind, setAddKind] = useState("once");
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  function add(event: React.FormEvent) {
    return addMine({ event, online, toast, addKind, due, title, categoryId, priority, clearTitle: () => setTitle(""), load });
  }

  const refresh = () => { reload(); load(); };

  return (
    <div>
      <MyToolbar
        writable={canWrite(me.role)}
        online={online}
        categories={categories}
        title={title}
        due={due}
        categoryId={categoryId}
        priority={priority}
        addKind={addKind}
        tab={tab}
        kind={kind}
        filtersOpen={filtersOpen}
        onTitle={setTitle}
        onDue={setDue}
        onCategory={setCategoryId}
        onPriority={setPriority}
        onAddKind={setAddKind}
        onAdd={add}
        onTab={setTab}
        onKind={setKind}
        onFiltersOpen={setFiltersOpen}
        onReset={() => { setTab("all"); setKind(""); setFiltersOpen(false); }}
      />
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
