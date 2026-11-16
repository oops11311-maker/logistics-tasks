"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

type Project = { id: string; name: string; total: number; done: number; overdue: number; progress: number };

export default function ProjectsPage() {
  const { revision, me, online, toast, reload } = useApp();
  const [items, setItems] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const manage = me.role === "admin" || me.role === "manager";

  function load() {
    setLoading(true);
    setError("");
    api<{ items: Project[] }>("/api/projects")
      .then((data) => setItems(data.items))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [revision]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      await api("/api/categories", { method: "POST", mutate: true, body: JSON.stringify({ name }) });
      setName("");
      toast("저장했습니다.");
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
    }
  }

  if (loading && items.length === 0) return <State kind="loading">불러오는 중…</State>;
  if (error) return <State kind="error" onRetry={load}>{error}</State>;

  return (
    <div className="list">
      {manage ? (
        <form className="filters" onSubmit={(event) => void add(event)}>
          <input className="field grow" aria-label="프로젝트 이름" placeholder="새 프로젝트" value={name} onChange={(event) => setName(event.target.value)} required />
          <button className="btn primary mutate" disabled={!online}>추가</button>
        </form>
      ) : null}
      {items.length === 0 ? <State kind="empty">프로젝트가 없습니다.</State> : items.map((item) => (
        <Link key={item.id} href={`/team?categoryId=${item.id}`} className="panel">
          <div className="spread">
            <h2>{item.name}</h2>
            <span>{item.total === 0 ? "0%" : `${Math.round(item.progress * 100)}%`}</span>
          </div>
          <div className="progress" aria-hidden="true"><span style={{ width: `${item.total === 0 ? 0 : item.progress * 100}%` }} /></div>
          <p className="hint">전체 {item.total} · 완료 {item.done} · 지연 {item.overdue}</p>
        </Link>
      ))}
    </div>
  );
}
