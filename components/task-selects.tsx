"use client";

import { CADENCES, cadenceLabel, STATUSES, type Task } from "./api";

export function statusClass(status: string): string {
  if (status === "진행 중") return "s-진행";
  if (status === "확인 요청") return "s-확인";
  if (status === "완료") return "s-완료";
  if (status === "보류") return "s-보류";
  return "";
}

export function CadenceSelect({ task, onCadence }: { task: Task; onCadence: (task: Task, cadence: string) => void }) {
  return (
    <select className="control mutate" aria-label={`${task.title} 반복`} value={task.workKind} onChange={(event) => onCadence(task, event.target.value)}>
      {CADENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  );
}

export function StatusSelect({ task, onStatus }: { task: Task; onStatus: (task: Task, status: string) => void }) {
  return (
    <select className="control mutate" aria-label={`${task.title} 상태`} value={task.status} onChange={(event) => onStatus(task, event.target.value)}>
      {STATUSES.map((status) => <option key={status}>{status}</option>)}
    </select>
  );
}

export function cadenceText(task: Task): string {
  return cadenceLabel(task.workKind);
}
