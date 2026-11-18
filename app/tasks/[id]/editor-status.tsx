"use client";

import { CADENCES, PRIORITIES, STATUSES, type Task } from "@/components/api";

export function EditorStatus(props: {
  task: Task;
  locked: boolean;
  onUpdate: <K extends keyof Task>(key: K, value: Task[K]) => void;
}) {
  const { task } = props;
  return (
    <>
      <label className="stack">상태
        <select className="control" value={task.status} disabled={props.locked} onChange={(event) => props.onUpdate("status", event.target.value)}>
          {STATUSES.map((status) => <option key={status}>{status}</option>)}
        </select>
      </label>
      <label className="stack">우선순위
        <select className="control" value={task.priority} disabled={props.locked} onChange={(event) => props.onUpdate("priority", event.target.value)}>
          {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
        </select>
      </label>
      <label className="stack">반복
        <select className="control" value={task.workKind} disabled={props.locked} onChange={(event) => props.onUpdate("workKind", event.target.value as Task["workKind"])}>
          {CADENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </>
  );
}
