"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { api, canWrite, PRIORITIES, STATUSES, type Task } from "@/components/api";
import { changeStatus, State, TaskTables } from "@/components/bits";
import { useApp } from "@/components/shell";

function TeamInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { categories, members, revision, me, online, toast, reload } = useApp();
  const [items, setItems] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("진행 중");
  const [bulkOwner, setBulkOwner] = useState("");
  const view = params.get("view") ?? "list";
  const month = params.get("month") ?? new Date().toISOString().slice(0, 7);

  const query = useMemo(() => {
    const next = new URLSearchParams();
    for (const key of ["q", "assigneeId", "categoryId", "status", "priority", "due"]) {
      const value = params.get(key);
      if (value) next.set(key, value);
    }
    if (view === "calendar") {
      const [year, mon] = month.split("-").map(Number);
      const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
      next.set("dueFrom", `${month}-01`);
      next.set("dueTo", `${month}-${String(last).padStart(2, "0")}`);
      next.delete("due");
    }
    next.set("limit", "100");
    return next.toString();
  }, [params, view, month]);

  function load() {
    setLoading(true);
    setError("");
    api<{ items: Task[] }>(`/api/tasks?${query}`)
      .then((data) => setItems(data.items))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [query, revision]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/team?${next.toString()}`);
  }

  async function applyBulk(kind: "status" | "owner") {
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    const versions: Record<string, number> = {};
    for (const task of items) if (selected.has(task.id)) versions[task.id] = task.version;
    const body = kind === "status"
      ? { ids: [...selected], versions, status: bulkStatus, holdReason: bulkStatus === "보류" ? window.prompt("보류 사유") : undefined }
      : { ids: [...selected], versions, ownerId: bulkOwner };
    if (kind === "status" && bulkStatus === "보류" && !body.holdReason) return;
    try {
      const result = await api<{ results: { ok: boolean; message?: string }[] }>("/api/tasks/bulk", {
        method: "POST",
        mutate: true,
        body: JSON.stringify(body),
      });
      const failed = result.results.filter((item) => !item.ok).length;
      toast(failed ? `${failed}건은 저장하지 못했습니다.` : "저장했습니다.");
      setSelected(new Set());
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
    }
  }

  const cells = calendarCells(month);

  return (
    <div>
      <div className="tabs">
        {[["list", "목록"], ["kanban", "칸반"], ["calendar", "달력"]].map(([key, label]) => (
          <button key={key} className={view === key ? "tab on" : "tab"} onClick={() => setParam("view", key)}>{label}</button>
        ))}
      </div>
      <form className="filters" onSubmit={(event) => event.preventDefault()}>
        <input className="field grow" aria-label="검색" placeholder="제목·본문 검색" defaultValue={params.get("q") ?? ""} onBlur={(event) => setParam("q", event.target.value)} />
        <select className="control" aria-label="담당자" value={params.get("assigneeId") ?? ""} onChange={(event) => setParam("assigneeId", event.target.value)}>
          <option value="">담당자 전체</option>
          {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
        <select className="control" aria-label="프로젝트" value={params.get("categoryId") ?? ""} onChange={(event) => setParam("categoryId", event.target.value)}>
          <option value="">프로젝트 전체</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select className="control" aria-label="상태" value={params.get("status") ?? ""} onChange={(event) => setParam("status", event.target.value)}>
          <option value="">상태 전체</option>
          {STATUSES.map((status) => <option key={status}>{status}</option>)}
        </select>
        <select className="control" aria-label="우선순위" value={params.get("priority") ?? ""} onChange={(event) => setParam("priority", event.target.value)}>
          <option value="">우선순위 전체</option>
          {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
        </select>
        <select className="control" aria-label="마감" value={params.get("due") ?? ""} onChange={(event) => setParam("due", event.target.value)}>
          <option value="">마감 전체</option>
          <option value="today">오늘</option>
          <option value="week">이번 주</option>
          <option value="overdue">지연</option>
          <option value="next">다음 주</option>
        </select>
      </form>
      {selected.size > 0 && canWrite(me.role) ? (
        <div className="filters">
          <select className="control" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} aria-label="일괄 상태">
            {STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
          <button className="btn mutate" disabled={!online} onClick={() => void applyBulk("status")}>상태 적용</button>
          {me.role === "admin" || me.role === "manager" ? (
            <>
              <select className="control" value={bulkOwner} onChange={(event) => setBulkOwner(event.target.value)} aria-label="일괄 담당자">
                <option value="">담당자</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
              <button className="btn mutate" disabled={!online || !bulkOwner} onClick={() => void applyBulk("owner")}>담당 적용</button>
            </>
          ) : null}
        </div>
      ) : null}
      {loading ? <State kind="loading">불러오는 중…</State> : error ? <State kind="error" onRetry={load}>{error}</State> : view === "kanban" ? (
        <div className="kanban">
          {STATUSES.map((status) => (
            <section key={status} className="column">
              <h3>{status}</h3>
              {items.filter((task) => task.status === status).map((task) => (
                <article key={task.id} className="kcard">
                  <Link href={task.href}><strong>{task.title}</strong></Link>
                  <div className="sub">{task.owner.name} · {task.dueDate ?? "마감 없음"}</div>
                  {canWrite(me.role) ? (
                    <select className="control mutate" aria-label={`${task.title} 상태`} value={task.status} onChange={(event) => void changeStatus(task, event.target.value, online, toast, reload)}>
                      {STATUSES.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  ) : null}
                </article>
              ))}
            </section>
          ))}
        </div>
      ) : view === "calendar" ? (
        <div>
          <div className="row">
            <button className="btn" onClick={() => setParam("month", shiftMonth(month, -1))}>이전 달</button>
            <strong>{month} · 서울</strong>
            <button className="btn" onClick={() => setParam("month", shiftMonth(month, 1))}>다음 달</button>
          </div>
          <div className="cal">
            {["월", "화", "수", "목", "금", "토", "일"].map((label) => <div key={label} className="dow">{label}</div>)}
            {cells.map((day, index) => (
              <div key={day || `blank-${index}`} className="day">
                {day ? (
                  <>
                    <b>{Number(day.slice(8))}</b>
                    {items.filter((task) => task.dueDate === day).map((task) => <Link key={task.id} href={task.href}>{task.title}</Link>)}
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <TaskTables
          items={items}
          writable={canWrite(me.role)}
          selected={selected}
          onSelect={(id, checked) => setSelected((current) => {
            const next = new Set(current);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
          })}
          onStatus={(task, status) => void changeStatus(task, status, online, toast, reload)}
        />
      )}
    </div>
  );
}

function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function calendarCells(month: string): string[] {
  const [year, mon] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const cells: string[] = Array.from({ length: offset }, () => "");
  for (let day = 1; day <= last; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  return cells;
}

export default function TeamPage() {
  return <Suspense fallback={<State kind="loading">불러오는 중…</State>}><TeamInner /></Suspense>;
}
