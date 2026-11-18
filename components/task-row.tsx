"use client";

import Link from "next/link";
import { type Task } from "./api";
import { CadenceSelect, cadenceText, statusClass, StatusSelect } from "./task-selects";

export function TaskRow(props: {
  task: Task;
  writable: boolean;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  onStatus?: (task: Task, status: string) => void;
  onCadence?: (task: Task, cadence: string) => void;
}) {
  const task = props.task;
  return (
    <tr className={task.overdue ? "late" : ""}>
      {props.onSelect ? <td><input type="checkbox" checked={props.selected ?? false} onChange={(event) => props.onSelect?.(task.id, event.target.checked)} aria-label={`${task.title} 선택`} /></td> : null}
      <td><Link href={task.href}>{task.title}</Link></td>
      <td>{props.onCadence && props.writable ? <CadenceSelect task={task} onCadence={props.onCadence} /> : <span className="chip">{cadenceText(task)}</span>}</td>
      <td>{task.categoryName ?? "—"}</td>
      <td>{task.owner.name}</td>
      <td>{props.onStatus && props.writable ? <StatusSelect task={task} onStatus={props.onStatus} /> : <span className={`chip ${statusClass(task.status)}`}>{task.status}</span>}</td>
      <td><span className={`chip p-${task.priority}`}>{task.priority}</span></td>
      <td>{task.dueDate ?? "—"}{task.dueTime ? ` ${task.dueTime}` : task.dueDate ? " 하루 끝" : ""}</td>
    </tr>
  );
}
