"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError, dueLabel, type Task } from "@/lib/api";
import { priorityLabel, statusLabel } from "@/lib/labels";
import { useApp } from "./shell";

type History = { id: string; taskId: string; taskTitle?: string; actorName: string; actorKind: string; field: string; oldLabel: string; newLabel: string; createdAt: string };
type Dash = {
  today: string;
  week: { start: string; end: string };
  mineToday: Task[];
  mineOverdue: Task[];
  mineDueThisWeek: Task[];
  needsReview: Task[];
  workload: { assigneeId: string | null; assigneeName: string; open: number; overdue: number }[];
  recent: History[];
  summaries: { daily: { periodKey: string; body: string; createdAt: string } | null; weekly: { periodKey: string; body: string; createdAt: string } | null };
  alerts: { level: string; text: string }[];
};

function TaskLinks({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) return <p className="empty">해당 작업이 없습니다.</p>;
  return (
    <div className="cards">
      {tasks.map((task) => (
        <Link key={task.id} href={`/tasks/${task.id}`} className="card" style={{ textDecoration: "none" }}>
          <strong>{task.title}</strong>
          <div className="meta">
            <span className={`status ${task.status}`}>{statusLabel(task.status)}</span>
            <span className={`priority ${task.priority}`}>{priorityLabel(task.priority)}</span>
            <span>{dueLabel(task)}</span>
            {task.overdue ? <span>기한 지남</span> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function Dashboard() {
  const { toast } = useApp();
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");

  function load() {
    api<Dash>("/api/dashboard").then(setData).catch((reason: unknown) => {
      setError(reason instanceof ApiError ? reason.message : "현황을 불러오지 못했습니다.");
    });
  }
  useEffect(load, []);

  if (error) return <div className="error"><p>{error}</p><button className="solid" onClick={load}>다시 시도</button></div>;
  if (!data) return <p className="loading">불러오는 중</p>;
  return (
    <div className="grid">
      <div>
        <h1 style={{ margin: "0 0 4px" }}>오늘 {data.today}</h1>
        <p className="meta">이번 주 {data.week.start} ~ {data.week.end} · Asia/Seoul</p>
      </div>
      {data.alerts.map((alert) => (
        <div key={alert.text} className={alert.level === "warning" ? "warn" : "note"}>{alert.text}</div>
      ))}
      <section className="grid stats">
        <article className="panel"><h2>오늘 마감</h2><TaskLinks tasks={data.mineToday} /></article>
        <article className="panel"><h2>기한 지남</h2><TaskLinks tasks={data.mineOverdue} /></article>
        <article className="panel"><h2>이번 주 마감</h2><TaskLinks tasks={data.mineDueThisWeek} /></article>
        <article className="panel"><h2>확인 요청</h2><TaskLinks tasks={data.needsReview} /></article>
      </section>
      <section className="cards dual">
        <article className="panel">
          <h2>담당자별 진행</h2>
          {data.workload.length === 0 ? <p className="empty">진행 중인 작업이 없습니다.</p> : data.workload.map((row) => (
            <div key={row.assigneeId ?? "none"} style={{ marginBottom: 10 }}>
              <div className="row"><strong className="grow">{row.assigneeName}</strong><span>{row.open}건 · 지연 {row.overdue}</span></div>
              <div className="progress"><span style={{ width: `${Math.min(100, row.overdue === 0 ? 100 : Math.round(((row.open - row.overdue) / row.open) * 100))}%` }} /></div>
            </div>
          ))}
        </article>
        <article className="panel">
          <h2>최근 변경</h2>
          {data.recent.length === 0 ? <p className="empty">변경 기록이 없습니다.</p> : (
            <ul className="history">
              {data.recent.map((item) => (
                <li key={item.id}>
                  <Link href={`/tasks/${item.taskId}`}>{item.taskTitle || "작업"}</Link>
                  <div className="meta">{item.actorName} · {item.actorKind === "bot" ? "봇" : "사람"} · {item.oldLabel} → {item.newLabel}</div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
      <section className="panel">
        <h2>봇 요약</h2>
        {data.summaries.daily ? <pre style={{ whiteSpace: "pre-wrap" }}>{data.summaries.daily.body}</pre> : <p className="empty">오늘 요약이 아직 없습니다.</p>}
        {data.summaries.weekly ? <pre style={{ whiteSpace: "pre-wrap" }}>{data.summaries.weekly.body}</pre> : <p className="empty">주간 초안이 아직 없습니다.</p>}
        <button className="quiet" onClick={() => { navigator.clipboard.writeText(data.summaries.daily?.body || data.summaries.weekly?.body || "").then(() => toast("요약을 복사했습니다.")).catch(() => toast("복사하지 못했습니다.", false)); }}>요약 복사</button>
      </section>
    </div>
  );
}
