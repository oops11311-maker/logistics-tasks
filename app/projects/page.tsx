"use client";

import { useEffect, useState } from "react";
import { ArchiveDialog, ProjectTable, type ProjectRow } from "@/app/projects/board";
import { api } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

export default function ProjectsPage() {
  const { revision, me, online, toast, reload } = useApp();
  const [items, setItems] = useState<ProjectRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<ProjectRow | null>(null);
  const manage = me.role === "admin";

  function load() {
    setLoading(true);
    setError("");
    api<{ items: ProjectRow[] }>("/api/projects")
      .then((data) => setItems(data.items))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [revision]);

  async function remove() {
    if (!pending) return;
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    const target = pending;
    try {
      await api(`/api/categories/${target.id}`, { method: "DELETE", mutate: true });
      setPending(null);
      toast("게시판을 보관했습니다. 연결된 업무는 그대로입니다.");
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "보관하지 못했습니다.");
    }
  }

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
      <p className="hint">프로젝트 게시판입니다. 글을 올리면 고른 담당자의 내 업무에 들어갑니다.</p>
      {manage ? (
        <form className="filters" onSubmit={(event) => void add(event)}>
          <input className="field grow" aria-label="프로젝트 이름" placeholder="새 게시판" value={name} onChange={(event) => setName(event.target.value)} required />
          <button className="btn primary mutate" disabled={!online}>게시판 추가</button>
        </form>
      ) : null}
      <ProjectTable items={items} manage={manage} onDelete={setPending} />
      {pending ? <ArchiveDialog pending={pending} online={online} onCancel={() => setPending(null)} onArchive={() => void remove()} /> : null}
    </div>
  );
}
