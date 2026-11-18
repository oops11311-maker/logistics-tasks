"use client";

import { CADENCES, PRIORITIES, STATUSES } from "@/components/api";

export function FilterStatus(props: {
  status: string;
  priority: string;
  kind: string;
  due: string;
  onParam: (key: string, value: string) => void;
}) {
  return (
    <>
      <select className="control" aria-label="상태" value={props.status} onChange={(event) => props.onParam("status", event.target.value)}>
        <option value="">상태 전체</option>
        {STATUSES.map((status) => <option key={status}>{status}</option>)}
      </select>
      <select className="control" aria-label="우선순위" value={props.priority} onChange={(event) => props.onParam("priority", event.target.value)}>
        <option value="">우선순위 전체</option>
        {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
      </select>
      <select className="control" aria-label="반복" value={props.kind} onChange={(event) => props.onParam("kind", event.target.value)}>
        <option value="">반복 전체</option>
        {CADENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select className="control" aria-label="마감" value={props.due} onChange={(event) => props.onParam("due", event.target.value)}>
        <option value="">마감 전체</option>
        <option value="today">오늘</option>
        <option value="week">이번 주</option>
        <option value="overdue">지연</option>
        <option value="next">다음 주</option>
      </select>
    </>
  );
}
