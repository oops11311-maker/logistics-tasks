"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, CADENCES, cadenceLabel, canWrite, formatWhen, type Task } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

type Board = {
  project: { id: string; name: string; total: number; done: number; overdue: number };
  posts: Task[];
};

export default function ProjectBoardPage() {
  const params = useParams<{ id: string }>();
  const { members, me, online, toast, reload, revision } = useApp();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [due, setDue] = useState("");
  const [kind, setKind] = useState<Task["workKind"]>("once");
  const [assignees, setAssignees] = useState<string[]>([]);
  const people = members.some((person) => person.id === me.id) ? members : [{ id: me.id, name: me.name, email: me.email }, ...members];
  const admin = me.role === "admin";

  function load() {
    setLoading(true);
    setError("");
    api<Board>(`/api/projects/${params.id}`)
      .then(setBoard)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [params.id, revision]);

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      await api(`/api/projects/${params.id}/posts`, {
        method: "POST",
        mutate: true,
        body: JSON.stringify({
          title,
          body,
          dueDate: due || null,
          workKind: kind,
          assigneeIds: admin && assignees.length > 0 ? assignees : [me.id],
        }),
      });
      setTitle("");
      setBody("");
      setDue("");
      toast("담당자 업무에 넣었습니다.");
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "올리지 못했습니다.");
    }
  }

  if (loading && !board) return <State kind="loading">불러오는 중…</State>;
  if (error) return <State kind="error" onRetry={load}>{error}</State>;
  if (!board) return <State kind="empty">게시판을 찾지 못했습니다.</State>;

  const names = (task: Task) => [task.owner.name, ...task.collaborators.map((person) => person.name)].join(", ");

  return (
    <div className="list">
      <p className="hint"><Link href="/projects">프로젝트</Link> · {board.project.name} · 글 {board.project.total} · 완료 {board.project.done} · 지연 {board.project.overdue}</p>
      {canWrite(me.role) ? (
        <form className="panel" onSubmit={(event) => void publish(event)}>
          <h2>글 올리기</h2>
          <p className="hint">{admin ? "고른 담당자의 내 업무에 들어갑니다. 비우면 내 업무에 들어갑니다." : "이 글은 내 업무에 들어갑니다. 다른 사람에게 넣으려면 관리자여야 합니다."}</p>
          <input className="field" aria-label="제목" placeholder="제목" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <textarea className="field" aria-label="본문" placeholder="내용" value={body} onChange={(event) => setBody(event.target.value)} />
          <div className="filters">
            <label className="stack">마감
              <input className="field" type="date" value={due} onChange={(event) => setDue(event.target.value)} />
            </label>
            <label className="stack">구분
              <select className="control" value={kind} onChange={(event) => setKind(event.target.value as Task["workKind"])}>
                {CADENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {admin ? (
              <label className="stack">담당
                <select className="control" multiple aria-label="담당자" value={assignees} onChange={(event) => setAssignees([...event.target.selectedOptions].map((option) => option.value))}>
                  {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
              </label>
            ) : null}
            <button className="btn primary mutate" disabled={!online}>올리기</button>
          </div>
        </form>
      ) : null}
      {board.posts.length === 0 ? <State kind="empty">아직 글이 없습니다.</State> : (
        <div className="table-wrap">
          <table className="board">
            <thead>
              <tr><th>제목</th><th>담당</th><th>구분</th><th>상태</th><th>마감</th><th>올린 시각</th></tr>
            </thead>
            <tbody>
              {board.posts.map((post) => (
                <tr key={post.id} className={post.overdue ? "late" : ""}>
                  <td><Link href={post.href}>{post.title}</Link><span className="sub">{post.body ? post.body.slice(0, 80) : "본문 없음"}</span></td>
                  <td>{names(post)}</td>
                  <td>{cadenceLabel(post.workKind)}</td>
                  <td>{post.status}</td>
                  <td>{post.dueDate ?? "—"}</td>
                  <td>{formatWhen(post.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
