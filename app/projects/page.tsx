"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, formatWhen } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

type Project = {
  id: string;
  name: string;
  total: number;
  done: number;
  overdue: number;
  progress: number;
  latestTitle: string | null;
  latestAt: string | null;
  latestOwner: string | null;
  linked: number;
};

export default function ProjectsPage() {
  const { revision, me, online, toast, reload } = useApp();
  const [items, setItems] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<Project | null>(null);
  const manage = me.role === "admin";

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
      {items.length === 0 ? <State kind="empty">게시판이 없습니다.</State> : (
        <div className="table-wrap">
          <table className="board">
            <thead>
              <tr><th>게시판</th><th>글</th><th>진행</th><th>최근 글</th><th>올린 사람</th><th>시각</th>{manage ? <th /> : null}</tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><Link href={`/projects/${item.id}`}>{item.name}</Link></td>
                  <td>{item.total}</td>
                  <td>완료 {item.done} · 지연 {item.overdue} · {item.total === 0 ? "0%" : `${Math.round(item.progress * 100)}%`}</td>
                  <td>{item.latestTitle ?? "글 없음"}</td>
                  <td>{item.latestOwner ?? "—"}</td>
                  <td>{formatWhen(item.latestAt)}</td>
                  {manage ? <td><button className="btn" type="button" onClick={() => setPending(item)}>삭제</button></td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pending ? (
        <div className="scrim" role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="archive-title">
            <h2 id="archive-title">게시판 보관</h2>
            <p>「{pending.name}」을 목록에서 뺍니다. 연결된 업무 {pending.linked}건은 지우지 않고 그대로 둡니다.</p>
            <div className="row">
              <button className="btn" type="button" onClick={() => setPending(null)}>취소</button>
              <button className="btn primary mutate" type="button" disabled={!online} onClick={() => void remove()}>보관</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
