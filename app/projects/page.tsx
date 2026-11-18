"use client";

import { useEffect, useState } from "react";
import { ArchiveDialog, ProjectTable, type ProjectRow } from "@/app/projects/board";
import { addProject, archiveProject } from "@/app/projects/project-actions";
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

  function remove() {
    return archiveProject({ pending, online, toast, clear: () => setPending(null), reload });
  }

  function add(event: React.FormEvent) {
    return addProject({ event, online, toast, name, clear: () => setName(""), reload });
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
