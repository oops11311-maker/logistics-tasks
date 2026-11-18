"use client";

import { type AdminState } from "@/app/admin/types";
import { formatWhen } from "@/components/api";

export function RunHistory(props: { runs: AdminState["runs"] }) {
  if (props.runs.length === 0) return <p className="state">실행 기록이 없습니다.</p>;
  return (
    <>
      {props.runs.slice(0, 12).map((run) => (
        <div key={run.id} className="item">
          <span>{run.job} · {run.status} · {run.source}</span>
          <span className="sub">{formatWhen(run.startedAt)}{run.error ? ` · ${run.error}` : ""}</span>
        </div>
      ))}
    </>
  );
}
