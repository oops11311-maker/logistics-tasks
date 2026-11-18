"use client";

import { useEffect, useState } from "react";
import { ReportBoard } from "@/app/reports/report-board";
import { copyReport, downloadReport } from "@/app/reports/report-files";
import { reportPosts, reportRows } from "@/app/reports/report-posts";
import { type ReportLine } from "@/app/reports/lines";
import { api } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

type Report = {
  week: { start: string; end: string };
  text: string;
  csv: string;
  doneThisWeek: ReportLine[];
  inProgress: ReportLine[];
  overdue: ReportLine[];
  nextWeekTasks: ReportLine[];
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

  if (loading && !report) return <State kind="loading">불러오는 중…</State>;
  if (error) return <State kind="error" onRetry={load}>{error}</State>;
  if (!report) return <State kind="empty">보고서가 없습니다.</State>;

  const posts = reportPosts(report);
  const rows = reportRows(report, open);

  return (
    <div className="list">
      <div className="row">
        <button className="btn" onClick={() => void copyReport(report.text, toast)}>보고서 복사</button>
        <button className="btn" onClick={() => downloadReport(report.csv)}>CSV 받기</button>
        <span className="hint">서울 {report.week.start}–{report.week.end}. 글은 저장된 업무만 모읍니다.</span>
      </div>
      <ReportBoard open={open} posts={posts} people={report.byAssignee} rows={rows} onOpen={(id) => setOpen(id as (typeof ORDER)[number])} />
    </div>
  );
}
