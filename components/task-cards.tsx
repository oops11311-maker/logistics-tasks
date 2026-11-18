"use client";

import Link from "next/link";
import { type Task } from "./api";
import { CadenceSelect, cadenceText, StatusSelect } from "./task-selects";

export function TaskCards(props: {
  items: Task[];
  writable: boolean;
  selected?: Set<string>;
  onSelect?: (id: string, checked: boolean) => void;
  onStatus?: (task: Task, status: string) => void;
  onCadence?: (task: Task, cadence: string) => void;
}) {
  return (
    <div className="cards">
      {props.items.map((task) => (
        <article key={task.id} className={task.overdue ? "mcard late" : "mcard"}>
          {props.onSelect ? <label className="check"><input type="checkbox" checked={props.selected?.has(task.id) ?? false} onChange={(event) => props.onSelect?.(task.id, event.target.checked)} />선택</label> : null}
          <Link href={task.href}><strong>{task.title}</strong></Link>
          <div className="sub">{cadenceText(task)} · {task.categoryName ?? "프로젝트 없음"} · {task.owner.name} · {task.dueDate ?? "마감 없음"}</div>
          {props.onCadence && props.writable ? <CadenceSelect task={task} onCadence={props.onCadence} /> : null}
          <div className="row">
            <span className={`chip p-${task.priority}`}>{task.priority}</span>
            <span className="chip">{task.status}</span>
          </div>
          {props.onStatus && props.writable ? <StatusSelect task={task} onStatus={props.onStatus} /> : null}
        </article>
      ))}
    </div>
  );
}
