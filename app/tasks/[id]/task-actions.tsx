"use client";

import { TaskButtons } from "@/app/tasks/[id]/task-buttons";
import { formatWhen, type Task } from "@/components/api";

export function TaskActions(props: {
  task: Task;
  editable: boolean;
  online: boolean;
  locked: boolean;
  onUpdate: <K extends keyof Task>(key: K, value: Task[K]) => void;
  onSave: () => void;
  onAct: (path: string) => void;
}) {
  const { task } = props;
  return (
    <>
      <label className="stack">태그
        <input className="field" value={task.tags.join(", ")} disabled={props.locked} onChange={(event) => props.onUpdate("tags", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />
      </label>
      <p className="hint">만든 사람 {task.creator.name} · 생성 {formatWhen(task.createdAt)} · 수정 {formatWhen(task.updatedAt)} · 완료 {formatWhen(task.completedAt)}</p>
      {task.recurrence ? <p className="hint">반복 {task.recurrence.freq} · 다음 {task.recurrence.nextRunOn ?? "중지"}</p> : null}
      <TaskButtons task={task} editable={props.editable} online={props.online} onSave={props.onSave} onAct={props.onAct} />
    </>
  );
}
