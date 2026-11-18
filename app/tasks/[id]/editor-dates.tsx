"use client";

import { type Task } from "@/components/api";

export function EditorDates(props: {
  task: Task;
  locked: boolean;
  onUpdate: <K extends keyof Task>(key: K, value: Task[K]) => void;
}) {
  const { task } = props;
  return (
    <>
      <label className="stack">시작
        <input className="field" type="date" value={task.startDate ?? ""} disabled={props.locked} onChange={(event) => props.onUpdate("startDate", event.target.value || null)} />
      </label>
      <label className="stack">마감
        <input className="field" type="date" value={task.dueDate ?? ""} disabled={props.locked} onChange={(event) => props.onUpdate("dueDate", event.target.value || null)} />
      </label>
      <label className="stack">마감 시각
        <input className="field" type="time" value={task.dueTime ?? ""} disabled={props.locked} onChange={(event) => props.onUpdate("dueTime", event.target.value || null)} />
      </label>
    </>
  );
}
