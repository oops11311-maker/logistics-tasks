"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PostForm, PostTable } from "@/app/projects/[id]/posts";
import { publishPost } from "@/app/projects/[id]/publish-post";
import { api, canWrite, type Task } from "@/components/api";
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

  function publish(event: React.FormEvent) {
    return publishPost({
      event, online, toast, projectId: params.id, title, body, due, kind, admin, assignees, meId: me.id,
      clear: () => { setTitle(""); setBody(""); setDue(""); }, reload,
    });
  }

  if (loading && !board) return <State kind="loading">불러오는 중…</State>;
  if (error) return <State kind="error" onRetry={load}>{error}</State>;
  if (!board) return <State kind="empty">게시판을 찾지 못했습니다.</State>;

  return (
    <div className="list">
      <p className="hint"><Link href="/projects">프로젝트</Link> · {board.project.name} · 글 {board.project.total} · 완료 {board.project.done} · 지연 {board.project.overdue}</p>
      {canWrite(me.role) ? (
        <PostForm
          admin={admin}
          online={online}
          title={title}
          body={body}
          due={due}
          kind={kind}
          assignees={assignees}
          people={people}
          onTitle={setTitle}
          onBody={setBody}
          onDue={setDue}
          onKind={setKind}
          onAssignees={setAssignees}
          onSubmit={publish}
        />
      ) : null}
      <PostTable posts={board.posts} />
    </div>
  );
}
