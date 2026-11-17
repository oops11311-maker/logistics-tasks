"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

type Line = { id: string; href: string; title: string; ownerName: string; status: string; dueDate: string | null; delayReason: string | null };
type Report = {
  week: { start: string; end: string };
  text: string;
  csv: string;
  doneThisWeek: Line[];
  inProgress: Line[];
  overdue: Line[];
  nextWeekTasks: Line[];
  byAssignee: { id: string; name: string; open: number; overdue: number; doneThisWeek: number }[];
};

const ORDER = ["done", "progress", "overdue", "next", "people"] as const;

export default function ReportsPage() {
  const { revision, toast } = useApp();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<(typeof ORDER)[number]>("done");

  function load() {
    setLoading(true);
    setError("");
    api<Report>("/api/reports")
      .then(setReport)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [revision]);

  async function copy() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.text);
      toast("보고서를 복사했습니다.");
    } catch {
      toast("복사하지 못했습니다. 글 안의 목록을 선택하세요.");
    }
  }

  function download() {
    if (!report) return;
    const blob = new Blob([`\uFEFF${report.csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading && !report) return <State kind="loading">불러오는 중…</State>;
  if (error) return <State kind="error" onRetry={load}>{error}</State>;
  if (!report) return <State kind="empty">보고서가 없습니다.</State>;

  const posts = [
    { id: "done" as const, title: "이번 주 완료", count: report.doneThisWeek.length, hint: "이번 주 서울 주에 완료된 업무" },
    { id: "progress" as const, title: "진행 중", count: report.inProgress.length, hint: "아직 끝나지 않은 진행 중 업무" },
    { id: "overdue" as const, title: "마감 지남", count: report.overdue.length, hint: "지연 사유가 없으면 사유 미입력" },
    { id: "next" as const, title: "다음 주", count: report.nextWeekTasks.length, hint: "다음 주 마감인 업무" },
    { id: "people" as const, title: "담당자별", count: report.byAssignee.length, hint: "담당자별 진행, 지연, 이번 주 완료" },
  ];
  const current = posts.find((post) => post.id === open) ?? posts[0];

  return (
    <div className="list">
      <div className="row">
        <button className="btn" onClick={() => void copy()}>보고서 복사</button>
        <button className="btn" onClick={download}>CSV 받기</button>
        <span className="hint">서울 {report.week.start}–{report.week.end}. 글은 저장된 업무만 모읍니다.</span>
      </div>
      <div className="table-wrap">
        <table className="board">
          <thead>
            <tr><th>글</th><th>건수</th><th>내용</th></tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className={post.id === open ? "active" : ""}>
                <td><button className="btn" onClick={() => setOpen(post.id)}>{post.title}</button></td>
                <td>{post.count}</td>
                <td>{post.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <article className="panel article">
        <h2>{current.title} {current.count}건</h2>
        <p className="hint">{current.hint}</p>
        {open === "people" ? report.byAssignee.map((row) => (
          <Link key={row.id} href={`/team?assigneeId=${row.id}`} className="item">
            <span className="title">{row.name}</span>
            <span className="sub">진행 {row.open} · 지연 {row.overdue} · 이번 주 완료 {row.doneThisWeek}</span>
          </Link>
        )) : <Lines rows={rowsOf(report, open)} delay={open === "overdue"} />}
      </article>
    </div>
  );
}

function rowsOf(report: Report, id: (typeof ORDER)[number]): Line[] {
  if (id === "done") return report.doneThisWeek;
  if (id === "progress") return report.inProgress;
  if (id === "overdue") return report.overdue;
  if (id === "next") return report.nextWeekTasks;
  return [];
}

function Lines({ rows, delay }: { rows: Line[]; delay: boolean }) {
  if (rows.length === 0) return <p className="state">없음</p>;
  return (
    <div className="table-wrap">
      <table className="board">
        <thead>
          <tr><th>업무</th><th>담당</th><th>상태</th><th>마감</th>{delay ? <th>지연 사유</th> : null}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><Link href={row.href}>{row.title}</Link></td>
              <td>{row.ownerName}</td>
              <td>{row.status}</td>
              <td>{row.dueDate ?? "—"}</td>
              {delay ? <td>{row.delayReason?.trim() ? row.delayReason : "사유 미입력"}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
