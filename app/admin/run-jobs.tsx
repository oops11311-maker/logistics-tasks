"use client";

import { type AdminState } from "@/app/admin/types";
import { formatWhen } from "@/components/api";

export function RunJobs(props: { jobs: AdminState["jobs"] }) {
  return (
    <>
      {props.jobs.map((job) => (
        <div key={job.job} className={job.warning ? "item late" : "item"}>
          <span>
            <span className="title">{job.label}</span>
            <span className="sub">성공 {formatWhen(job.lastSuccessAt)} · 다음 {formatWhen(job.nextDueAt)} · 재시도 {job.retryCount}{job.lastError ? ` · ${job.lastError}` : ""}</span>
          </span>
          {job.warning ? <span className="chip p-긴급">{job.warningText}</span> : null}
        </div>
      ))}
    </>
  );
}
