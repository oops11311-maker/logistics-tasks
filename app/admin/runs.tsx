"use client";

import { type AdminState } from "@/app/admin/types";
import { api, formatWhen } from "@/components/api";

export function RunsSection(props: {
  data: AdminState;
  online: boolean;
  toast: (message: string) => void;
  reload: () => void;
}) {
  async function runJobs() {
    if (!props.online) return props.toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      await api("/api/admin/jobs/run", { method: "POST", mutate: true, body: "{}" });
      props.toast("작업을 실행했습니다.");
      props.reload();
    } catch (reason) {
      props.toast(reason instanceof Error ? reason.message : "실행하지 못했습니다.");
    }
  }

  const { data } = props;
  return (
    <section className="panel">
      <h2>연동과 실행 기록</h2>
      <p>봇 API 토큰: {data.integration.botTokenConfigured ? "설정됨" : "설정되지 않음"}</p>
      <p>스케줄 웹훅 토큰: {data.integration.schedulerTokenConfigured ? "설정됨" : "설정되지 않음"}</p>
      <p>무인 스케줄: {data.integration.unattendedScheduling ? "켜짐" : "꺼짐"}</p>
      <p className="hint">{data.integration.schedulingNote}</p>
      <p className="hint">{data.integration.backupNote}</p>
      <button className="btn mutate" disabled={!props.online} onClick={() => void runJobs()}>지금 실행</button>
      {data.jobs.map((job) => (
        <div key={job.job} className={job.warning ? "item late" : "item"}>
          <span>
            <span className="title">{job.label}</span>
            <span className="sub">성공 {formatWhen(job.lastSuccessAt)} · 다음 {formatWhen(job.nextDueAt)} · 재시도 {job.retryCount}{job.lastError ? ` · ${job.lastError}` : ""}</span>
          </span>
          {job.warning ? <span className="chip p-긴급">{job.warningText}</span> : null}
        </div>
      ))}
      <h2>최근 실행</h2>
      {data.runs.length === 0 ? <p className="state">실행 기록이 없습니다.</p> : data.runs.slice(0, 12).map((run) => (
        <div key={run.id} className="item">
          <span>{run.job} · {run.status} · {run.source}</span>
          <span className="sub">{formatWhen(run.startedAt)}{run.error ? ` · ${run.error}` : ""}</span>
        </div>
      ))}
    </section>
  );
}
