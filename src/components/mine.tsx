"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError, dueLabel, type Task } from "@/lib/api";
import { PRIORITIES, STATUSES, priorityLabel, statusLabel } from "@/lib/labels";
import { useApp } from "./shell";

const BUCKETS = [
  { id: "today", label: "오늘" },
  { id: "week", label: "이번 주" },
  { id: "all", label: "전체" },
  { id: "done", label: "완료" },
];

export function Mine() {
  const { me, online, toast } = useApp();
  const [bucket, setBucket] = useState("today");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(me.today);
  const [priority, setPriority] = useState("normal");
  const [hold, setHold] = useState("");

  function load() {
    api<{ tasks: Task[] }>(`/api/tasks?bucket=${bucket}&assignee=me`).then((data) => {
      setTasks(data.tasks);
      setError("");
    }).catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : "작업을 불러오지 못했습니다."));
  }
  useEffect(load, [bucket]);

  async function add() {
    if (!online) return toast("오프라인에서는 저장할 수 없습니다.", false);
    try {
      await api("/api/tasks", { method: "POST", body: JSON.stringify({ title, dueDate: due, priority, assigneeId: me.member.id }) });
      setTitle("");
      toast("작업을 추가했습니다.");
      load();
    } catch (reason) {
      toast(reason instanceof ApiError ? reason.message : "저장하지 못했습니다.", false);
    }
  }

  async function setStatus(task: Task, status: string) {
    if (!online) return toast("오프라인에서는 저장할 수 없습니다.", false);
    if (status === "hold" && !hold.trim()) return toast("보류 사유를 입력하세요.", false);
    try {
      await api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ version: task.version, status, holdReason: status === "hold" ? hold : undefined }) });
      toast("상태를 바꿨습니다.");
      load();
    } catch (reason) {
      toast(reason instanceof ApiError ? reason.message : "상태를 바꾸지 못했습니다.", false);
      if (reason instanceof ApiError && reason.status === 409) load();
    }
  }

  return (
    <div className="grid">
      <h1 style={{ margin: 0 }}>내 작업</h1>
      <div className="tabs">
        {BUCKETS.map((item) => (
          <button key={item.id} className="quiet" aria-pressed={bucket === item.id} onClick={() => setBucket(item.id)}>{item.label}</button>
        ))}
      </div>
      <form className="panel" onSubmit={(event) => { event.preventDefault(); void add(); }}>
        <h2>빠른 추가</h2>
        <div className="row">
          <input className="grow" aria-label="제목" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="제목" />
          <input aria-label="마감일" type="date" value={due} onChange={(event) => setDue(event.target.value)} />
          <select aria-label="우선순위" value={priority} onChange={(event) => setPriority(event.target.value)}>
            {PRIORITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <button className="solid" disabled={!online || !title.trim()}>추가</button>
        </div>
      </form>
      <label className="field"><span>보류로 바꿀 때 쓸 사유</span><input value={hold} onChange={(event) => setHold(event.target.value)} /></label>
      {error ? <div className="error"><p>{error}</p><button className="solid" onClick={load}>다시 시도</button></div> : null}
      {!tasks && !error ? <p className="loading">불러오는 중</p> : null}
      {tasks && tasks.length === 0 ? <p className="empty">표시할 작업이 없습니다.</p> : null}
      <div className="cards">
        {tasks?.map((task) => (
          <article key={task.id} className="card">
            <Link href={`/tasks/${task.id}`}><strong>{task.title}</strong></Link>
            <div className="meta">
              <span className={`status ${task.status}`}>{statusLabel(task.status)}</span>
              <span className={`priority ${task.priority}`}>{priorityLabel(task.priority)}</span>
              <span>{dueLabel(task)}</span>
              <span>{task.categoryName}</span>
            </div>
            <select aria-label={`${task.title} 상태`} value={task.status} disabled={!online} onChange={(event) => void setStatus(task, event.target.value)}>
              {STATUSES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </article>
        ))}
      </div>
    </div>
  );
}
