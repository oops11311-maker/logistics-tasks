"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { TaskActivity } from "@/app/tasks/[id]/activity";
import { TaskEditor } from "@/app/tasks/[id]/editor";
import { api, ApiError, canWrite, type Task } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

type Detail = {
  task: Task;
  comments: { id: string; body: string; kind: string; createdAt: string | null; author: { name: string } }[];
  events: { id: string; action: string; field: string | null; oldValue: string | null; newValue: string | null; actorKind: string; actorName: string; createdAt: string | null }[];
};

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

  async function save() {
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      const saved = await api<Detail>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        mutate: true,
        body: JSON.stringify({
          version: task.version,
          title: task.title,
          body: task.body,
          categoryId: task.categoryId,
          ...(me.role === "admin" ? {
            ownerId: task.owner.id,
            collaboratorIds: task.collaborators.map((person) => person.id),
          } : {}),
          startDate: task.startDate,
          dueDate: task.dueDate,
          dueTime: task.dueTime,
          priority: task.priority,
          status: task.status,
          checklist: task.checklist,
          tags: task.tags,
          links: task.links,
          holdReason: task.holdReason,
          delayReason: task.delayReason,
          workKind: task.workKind,
        }),
      });
      setDetail(saved);
      setDirty(false);
      toast("저장했습니다.");
      reload();
    } catch (reason) {
      toast(reason instanceof ApiError ? reason.message : "저장하지 못했습니다.");
      if (reason instanceof ApiError && reason.status === 409) load();
    }
  }

  async function act(path: string) {
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      const saved = await api<Detail>(path, { method: "POST", mutate: true, body: JSON.stringify({ version: task.version }) });
      setDetail(saved);
      toast("저장했습니다.");
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
    }
  }

  async function sendComment(event: React.FormEvent) {
    event.preventDefault();
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      await api(`/api/tasks/${task.id}/comments`, { method: "POST", mutate: true, body: JSON.stringify({ body: comment }) });
      setComment("");
      toast("저장했습니다.");
      load();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
    }
  }

  return (
    <div className="cards-2">
      <TaskEditor task={task} categories={categories} members={members} people={people} role={me.role} editable={editable} online={online} onUpdate={update} onSave={() => void save()} onAct={(path) => void act(path)} />
      <TaskActivity comments={detail.comments} events={detail.events} writable={canWrite(me.role)} online={online} comment={comment} onComment={setComment} onSubmit={sendComment} />
    </div>
  );
}
