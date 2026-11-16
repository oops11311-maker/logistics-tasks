"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError, dueLabel, type Person, type Task } from "@/lib/api";
import { PRIORITIES, STATUSES, priorityLabel, statusLabel } from "@/lib/labels";
import { useApp } from "./shell";

type Category = { id: string; name: string; active: boolean };

export function Team() {
  const { me, online, toast } = useApp();
  const [view, setView] = useState<"list" | "kanban" | "calendar">("list");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [assignee, setAssignee] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [due, setDue] = useState("");
  const [trashed, setTrashed] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(me.today.slice(0, 7));
  const [form, setForm] = useState({ title: "", body: "", categoryId: "", assigneeId: me.member.id, dueDate: me.today, priority: "normal", recurrence: "" });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (assignee) params.set("assignee", assignee);
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    if (due) params.set("due", due);
    if (trashed) params.set("trashed", "1");
    if (view === "calendar") {
      const [year, mon] = month.split("-").map(Number);
      const start = `${month}-01`;
      const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
      params.set("dueFrom", start);
      params.set("dueTo", `${month}-${String(last).padStart(2, "0")}`);
      params.delete("due");
    }
    params.set("limit", "100");
    return params.toString();
  }, [q, assignee, category, status, priority, due, trashed, view, month]);

  function load() {
    api<{ tasks: Task[] }>(`/api/tasks?${query}`).then((data) => {
      setTasks(data.tasks);
      setError("");
      setSelected([]);
    }).catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : "작업을 불러오지 못했습니다."));
  }
  useEffect(load, [query]);
  useEffect(() => {
    api<{ people: Person[] }>("/api/directory").then((data) => setPeople(data.people)).catch(() => undefined);
    api<{ categories: Category[] }>("/api/categories").then((data) => setCategories(data.categories)).catch(() => undefined);
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!online) return toast("오프라인에서는 저장할 수 없습니다.", false);
    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          categoryId: form.categoryId || undefined,
          assigneeId: form.assigneeId || null,
          dueDate: form.dueDate || null,
          priority: form.priority,
          recurrence: form.recurrence ? { frequency: form.recurrence } : undefined,
        }),
      });
      setOpen(false);
      setForm({ ...form, title: "", body: "" });
      toast("작업을 만들었습니다.");
      load();
    } catch (reason) {
      toast(reason instanceof ApiError ? reason.message : "저장하지 못했습니다.", false);
    }
  }

  async function changeStatus(task: Task, next: string) {
    if (!online) return toast("오프라인에서는 저장할 수 없습니다.", false);
    try {
      await api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ version: task.version, status: next, holdReason: next === "hold" ? "팀 화면에서 보류" : undefined }) });
      toast("상태를 바꿨습니다.");
      load();
    } catch (reason) {
      toast(reason instanceof ApiError ? reason.message : "상태를 바꾸지 못했습니다.", false);
      load();
    }
  }

  async function bulk(kind: "status" | "assignee", value: string) {
    if (!online) return toast("오프라인에서는 저장할 수 없습니다.", false);
    const items = (tasks ?? []).filter((task) => selected.includes(task.id)).map((task) => ({ id: task.id, version: task.version }));
    try {
      await api("/api/tasks/bulk", {
        method: "POST",
        body: JSON.stringify(kind === "status" ? { tasks: items, status: value, holdReason: value === "hold" ? "일괄 보류" : undefined } : { tasks: items, assigneeId: value }),
      });
      toast("일괄 반영했습니다.");
      load();
    } catch (reason) {
      toast(reason instanceof ApiError ? reason.message : "일괄 변경에 실패했습니다.", false);
      load();
    }
  }

  const canCreate = me.member.role !== "viewer";
  return (
    <div className="grid">
      <div className="row">
        <h1 className="grow" style={{ margin: 0 }}>팀 작업</h1>
        {canCreate ? <button className="solid" disabled={!online} onClick={() => setOpen((value) => !value)}>작업 추가</button> : null}
      </div>
      <div className="tabs">
        {([["list", "목록"], ["kanban", "칸반"], ["calendar", "달력"]] as const).map(([id, label]) => (
          <button key={id} className="quiet" aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>
        ))}
        {me.member.role !== "viewer" ? <button className="quiet" aria-pressed={trashed} onClick={() => setTrashed((value) => !value)}>휴지통</button> : null}
      </div>
      <div className="grid">
        <input aria-label="검색" placeholder="제목과 본문 검색" value={q} onChange={(event) => setQ(event.target.value)} />
        <div className="row">
          <select aria-label="담당자" value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">담당자 전체</option>
            <option value="me">내 담당</option>
            <option value="none">담당 없음</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
          <select aria-label="분류" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">분류 전체</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select aria-label="상태" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">상태 전체</option>
            {STATUSES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select aria-label="우선순위" value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="">우선순위 전체</option>
            {PRIORITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select aria-label="기한" value={due} onChange={(event) => setDue(event.target.value)}>
            <option value="">기한 전체</option>
            <option value="overdue">기한 지남</option>
            <option value="today">오늘</option>
            <option value="week">이번 주</option>
            <option value="next">다음 주</option>
            <option value="none">기한 없음</option>
          </select>
        </div>
      </div>
      {open ? (
        <form className="panel" onSubmit={create}>
          <h2>새 작업</h2>
          <label className="field"><span>제목</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
          <label className="field"><span>내용</span><textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
          <div className="row">
            <select aria-label="분류" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
              <option value="">기본 분류</option>
              {categories.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select aria-label="담당자" value={form.assigneeId} onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}>
              {people.filter((person) => person.role !== "viewer").map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
            <input aria-label="마감일" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            <select aria-label="우선순위" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
              {PRIORITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <select aria-label="반복" value={form.recurrence} onChange={(event) => setForm({ ...form, recurrence: event.target.value })}>
              <option value="">반복 없음</option>
              <option value="daily">매일</option>
              <option value="weekly">매주</option>
              <option value="monthly">매월</option>
            </select>
          </div>
          <button className="solid" disabled={!online}>저장</button>
        </form>
      ) : null}
      {selected.length > 0 ? (
        <div className="row panel">
          <span>{selected.length}건 선택</span>
          <select aria-label="일괄 상태" defaultValue="" onChange={(event) => { if (event.target.value) void bulk("status", event.target.value); }}>
            <option value="">상태 일괄 변경</option>
            {STATUSES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          {me.member.role === "admin" || me.member.role === "manager" ? (
            <select aria-label="일괄 담당" defaultValue="" onChange={(event) => { if (event.target.value) void bulk("assignee", event.target.value); }}>
              <option value="">담당 일괄 변경</option>
              {people.filter((person) => person.role !== "viewer").map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          ) : null}
        </div>
      ) : null}
      {error ? <div className="error"><p>{error}</p><button className="solid" onClick={load}>다시 시도</button></div> : null}
      {!tasks && !error ? <p className="loading">불러오는 중</p> : null}
      {tasks && tasks.length === 0 ? <p className="empty">표시할 작업이 없습니다.</p> : null}
      {view === "list" && tasks && tasks.length > 0 ? (
        <>
          <table className="list-table">
            <thead><tr><th></th><th>제목</th><th>담당</th><th>분류</th><th>상태</th><th>우선순위</th><th>기한</th></tr></thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td><input type="checkbox" aria-label={`${task.title} 선택`} checked={selected.includes(task.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, task.id] : selected.filter((id) => id !== task.id))} /></td>
                  <td><Link href={`/tasks/${task.id}`}>{task.title}</Link></td>
                  <td>{task.assigneeName || "없음"}</td>
                  <td>{task.categoryName}</td>
                  <td><span className={`status ${task.status}`}>{statusLabel(task.status)}</span></td>
                  <td className={`priority ${task.priority}`}>{priorityLabel(task.priority)}</td>
                  <td>{dueLabel(task)}{task.overdue ? " · 지남" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="phone-cards">
            {tasks.map((task) => (
              <article key={task.id} className="card">
                <div className="row">
                  <input type="checkbox" aria-label={`${task.title} 선택`} checked={selected.includes(task.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, task.id] : selected.filter((id) => id !== task.id))} />
                  <Link className="grow" href={`/tasks/${task.id}`}><strong>{task.title}</strong></Link>
                </div>
                <div className="meta"><span>{task.assigneeName || "담당 없음"}</span><span>{task.categoryName}</span><span>{dueLabel(task)}</span></div>
                <select aria-label={`${task.title} 상태`} value={task.status} disabled={!online || trashed} onChange={(event) => void changeStatus(task, event.target.value)}>
                  {STATUSES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </article>
            ))}
          </div>
        </>
      ) : null}
      {view === "kanban" && tasks ? (
        <div className="kanban">
          {STATUSES.map((column) => (
            <section key={column.id} className="column" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
              const raw = event.dataTransfer.getData("text/plain");
              const task = tasks.find((item) => item.id === raw);
              if (task && task.status !== column.id) void changeStatus(task, column.id);
            }}>
              <h2>{column.label}</h2>
              {tasks.filter((task) => task.status === column.id).map((task) => (
                <article key={task.id} className="card" draggable={online} onDragStart={(event) => event.dataTransfer.setData("text/plain", task.id)}>
                  <Link href={`/tasks/${task.id}`}><strong>{task.title}</strong></Link>
                  <div className="meta"><span>{task.assigneeName || "담당 없음"}</span><span>{dueLabel(task)}</span></div>
                  <select className="phone-cards" aria-label={`${task.title} 상태`} value={task.status} disabled={!online} onChange={(event) => void changeStatus(task, event.target.value)}>
                    {STATUSES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </article>
              ))}
            </section>
          ))}
        </div>
      ) : null}
      {view === "calendar" && tasks ? (
        <div>
          <div className="row">
            <button className="quiet" onClick={() => setMonth(shiftMonth(month, -1))}>이전 달</button>
            <strong>{month}</strong>
            <button className="quiet" onClick={() => setMonth(shiftMonth(month, 1))}>다음 달</button>
          </div>
          <div className="calendar month desktop-only" style={{ marginTop: 10 }}>
            {monthDays(month).map((day) => (
              <div key={day || "pad"} className="day">
                <strong>{day ? day.slice(8) : ""}</strong>
                {tasks.filter((task) => task.dueDate === day).map((task) => <div key={task.id}><Link href={`/tasks/${task.id}`}>{task.title}</Link></div>)}
              </div>
            ))}
          </div>
          <div className="calendar phone-cards" style={{ marginTop: 10 }}>
            {tasks.map((task) => (
              <div key={task.id} className="day">
                <strong>{task.dueDate}</strong> <Link href={`/tasks/${task.id}`}>{task.title}</Link>
                <div className="meta">{task.assigneeName || "담당 없음"}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthDays(month: string): string[] {
  const [year, mon] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const startPad = (first.getUTCDay() + 6) % 7;
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const days: string[] = Array.from({ length: startPad }, () => "");
  for (let day = 1; day <= last; day += 1) days.push(`${month}-${String(day).padStart(2, "0")}`);
  return days;
}
