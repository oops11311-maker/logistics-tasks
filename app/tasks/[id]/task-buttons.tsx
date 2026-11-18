"use client";

import { type Task } from "@/components/api";

export function TaskButtons(props: {
  task: Task;
  editable: boolean;
  online: boolean;
  onSave: () => void;
  onAct: (path: string) => void;
}) {
  const { task } = props;
  return (
    <div className="row">
      {props.editable ? <button className="btn primary mutate" disabled={!props.online} onClick={props.onSave}>저장</button> : null}
      {props.editable && task.status !== "완료" ? <button className="btn mutate" disabled={!props.online} onClick={() => props.onAct(`/api/tasks/${task.id}/complete`)}>완료</button> : null}
      {props.editable && task.status === "완료" ? <button className="btn mutate" disabled={!props.online} onClick={() => props.onAct(`/api/tasks/${task.id}/reopen`)}>다시 열기</button> : null}
      {props.editable && !task.deletedAt ? <button className="btn danger mutate" disabled={!props.online} onClick={() => props.onAct(`/api/tasks/${task.id}/trash`)}>휴지통</button> : null}
      {props.editable && task.deletedAt ? <button className="btn mutate" disabled={!props.online} onClick={() => props.onAct(`/api/tasks/${task.id}/restore`)}>복원</button> : null}
      {props.editable && task.recurrence?.active ? <button className="btn mutate" disabled={!props.online} onClick={() => props.onAct(`/api/tasks/${task.id}/recurrence/stop`)}>반복 중지</button> : null}
    </div>
  );
}
