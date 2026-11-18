import { type ReportLine } from "@/app/reports/lines";

type Report = {
  doneThisWeek: ReportLine[];
  inProgress: ReportLine[];
  overdue: ReportLine[];
  nextWeekTasks: ReportLine[];
  byAssignee: { length: number };
};

export function reportPosts(report: Report) {
  return [
    { id: "done", title: "이번 주 완료", count: report.doneThisWeek.length, hint: "이번 주 서울 주에 완료된 업무" },
    { id: "progress", title: "진행 중", count: report.inProgress.length, hint: "아직 끝나지 않은 진행 중 업무" },
    { id: "overdue", title: "마감 지남", count: report.overdue.length, hint: "지연 사유가 없으면 사유 미입력" },
    { id: "next", title: "다음 주", count: report.nextWeekTasks.length, hint: "다음 주 마감인 업무" },
    { id: "people", title: "담당자별", count: report.byAssignee.length, hint: "담당자별 진행, 지연, 이번 주 완료" },
  ];
}

export function reportRows(report: Report, open: string): ReportLine[] {
  if (open === "done") return report.doneThisWeek;
  if (open === "progress") return report.inProgress;
  if (open === "overdue") return report.overdue;
  if (open === "next") return report.nextWeekTasks;
  return [];
}
