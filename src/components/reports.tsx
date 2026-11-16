"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useApp } from "./shell";

type Line = { taskId: string; title: string; assignee: string; status: string; due: string; note: string; href: string };
type Report = {
  week: { start: string; end: string };
  nextWeek: { start: string; end: string };
  text: string;
  sections: { doneThisWeek: Line[]; inProgress: Line[]; overdue: Line[]; nextWeek: Line[]; byAssignee: { assignee: string; open: number; overdue: number; doneThisWeek: number }[] };
};

function Lines({ title, items }: { title: string; items: Line[] }) {
  return (
    <section className="panel">
      <h2>{title} {items.length}건</h2>
      {items.length === 0 ? <p className="empty">없습니다.</p> : items.map((item) => (
        <div key={`${title}-${item.taskId}`} className="comment">
          <Link href={item.href}>{item.title}</Link>
          <div className="meta"><span>{item.taskId}</span><span>{item.assignee}</span><span>{item.status}</span>{item.due ? <span>기한 {item.due}</span> : null}{item.note ? <span>{item.note}</span> : null}</div>
        </div>
      ))}
    </section>
  );
}

export function Reports() {
  const { toast } = useApp();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  function load() {
    api<Report>("/api/reports").then(setReport).catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : "보고서를 불러오지 못했습니다."));
  }
  useEffect(load, []);
  if (error) return <div className="error"><p>{error}</p><button className="solid" onClick={load}>다시 시도</button></div>;
  if (!report) return <p className="loading">불러오는 중</p>;
  return (
    <div className="grid">
      <div className="row">
        <h1 className="grow" style={{ margin: 0 }}>보고서</h1>
        <button className="quiet" onClick={() => navigator.clipboard.writeText(report.text).then(() => toast("보고서를 복사했습니다.")).catch(() => toast("복사하지 못했습니다.", false))}>텍스트 복사</button>
        <a className="solid" href="/api/reports.csv" style={{ textDecoration: "none", display: "inline-grid", placeItems: "center" }}>CSV</a>
      </div>
      <p className="meta">이번 주 {report.week.start} ~ {report.week.end} · 다음 주 {report.nextWeek.start} ~ {report.nextWeek.end} · Asia/Seoul. 없는 지연 사유는 사유 미입력으로 표시합니다.</p>
      <Lines title="이번 주 완료" items={report.sections.doneThisWeek} />
      <Lines title="진행 중" items={report.sections.inProgress} />
      <Lines title="기한 지남" items={report.sections.overdue} />
      <Lines title="다음 주 마감" items={report.sections.nextWeek} />
      <section className="panel">
        <h2>담당자별</h2>
        {report.sections.byAssignee.length === 0 ? <p className="empty">없습니다.</p> : report.sections.byAssignee.map((row) => (
          <div key={row.assignee} className="row"><strong className="grow">{row.assignee}</strong><span>미완료 {row.open}</span><span>지연 {row.overdue}</span><span>이번 주 완료 {row.doneThisWeek}</span></div>
        ))}
      </section>
    </div>
  );
}
