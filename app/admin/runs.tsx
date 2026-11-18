"use client";

import { RunHistory } from "@/app/admin/run-history";
import { RunJobs } from "@/app/admin/run-jobs";
import { type AdminState } from "@/app/admin/types";
import { api } from "@/components/api";

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
      <RunJobs jobs={data.jobs} />
      <h2>최근 실행</h2>
      <RunHistory runs={data.runs} />
    </section>
  );
}
