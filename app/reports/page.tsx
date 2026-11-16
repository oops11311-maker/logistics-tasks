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

export default function ReportsPage() {
  const { revision, toast } = useApp();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
      toast("복사하지 못했습니다. 아래 글을 선택하세요.");
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

  return (
    <div className="list">
      <div className="row">
        <button className="btn" onClick={() => void copy()}>보고서 복사</button>
        <button className="btn" onClick={download}>CSV 받기</button>
        <span className="hint">서울 {report.week.start}–{report.week.end}. 숫자는 저장된 업무만 셉니다.</span>
      </div>
      <Section title="이번 주 완료" rows={report.doneThisWeek} />
      <Section title="진행 중" rows={report.inProgress} />
      <Section title="마감 지남" rows={report.overdue} delay />
      <Section title="다음 주" rows={report.nextWeekTasks} />
      <section className="panel">
        <h2>담당자별</h2>
        {report.byAssignee.map((row) => (
          <Link key={row.id} href={`/team?assigneeId=${row.id}`} className="item">
            <span>{row.name}</span>
            <span className="sub">진행 {row.open} · 지연 {row.overdue} · 이번 주 완료 {row.doneThisWeek}</span>
          </Link>
        ))}
      </section>
      <pre className="copy">{report.text}</pre>
    </div>
  );
}

function Section({ title, rows, delay = false }: { title: string; rows: Line[]; delay?: boolean }) {
  return (
    <section className="panel">
      <h2>{title} {rows.length}건</h2>
      {rows.length === 0 ? <p className="state">없음</p> : rows.map((row) => (
        <Link key={row.id} href={row.href} className="item">
          <span>
            <span className="title">{row.title}</span>
            <span className="sub">{row.ownerName} · {row.status}{delay ? ` · ${row.delayReason?.trim() ? row.delayReason : "사유 미입력"}` : ""}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}
