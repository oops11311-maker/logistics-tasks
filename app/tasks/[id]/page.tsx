"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { TaskActivity } from "@/app/tasks/[id]/activity";
import { TaskEditor } from "@/app/tasks/[id]/editor";
import { actOnTask } from "@/app/tasks/[id]/task-act";
import { sendTaskComment } from "@/app/tasks/[id]/task-comment";
import { saveTask, type Detail } from "@/app/tasks/[id]/task-save";
import { api, canWrite, type Task } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

export default function TaskPage() {
  const params = useParams<{ id: string }>();
  const { categories, members, me, online, toast, revision, setDirty, reload } = useApp();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");

  function load() {
    setLoading(true);
    setError("");
    api<Detail>(`/api/tasks/${params.id}`)
      .then((data) => {
        setDetail(data);
        setDirty(false);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [params.id, revision]);

  if (loading && !detail) return <State kind="loading">불러오는 중…</State>;
  if (error) return <State kind="error" onRetry={load}>{error}</State>;
  if (!detail) return <State kind="empty">업무를 찾지 못했습니다.</State>;
  const task = detail.task;
  const editable = canWrite(me.role) && (me.role !== "member" || task.owner.id === me.id || task.collaborators.some((person) => person.id === me.id));
  const people = members.some((person) => person.id === me.id) ? members : [{ id: me.id, name: me.name, email: me.email }, ...members];

  function update<K extends keyof Task>(key: K, value: Task[K]) {
    setDetail((current) => current ? { ...current, task: { ...current.task, [key]: value } } : current);
    setDirty(true);
  }

  function sendComment(event: React.FormEvent) {
    return sendTaskComment({ event, online, toast, taskId: task.id, comment, clear: () => setComment(""), load });
  }

  return (
    <div className="cards-2">
      <TaskEditor task={task} categories={categories} members={members} people={people} role={me.role} editable={editable} online={online} onUpdate={update} onSave={() => void saveTask({ task, role: me.role, online, toast, reload, load, setDetail, setDirty })} onAct={(path) => void actOnTask({ path, version: task.version, online, toast, reload, setDetail })} />
      <TaskActivity comments={detail.comments} events={detail.events} writable={canWrite(me.role)} online={online} comment={comment} onComment={setComment} onSubmit={sendComment} />
    </div>
  );
}
