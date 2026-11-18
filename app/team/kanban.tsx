"use client";

import Link from "next/link";
import { cadenceLabel, canWrite, STATUSES, type Task } from "@/components/api";
import { changeStatus } from "@/components/bits";

export function TeamKanban(props: {
  items: Task[];
  role: string;
  online: boolean;
  toast: (message: string) => void;
  reload: () => void;
}) {
  return (
    <div className="kanban">
      {STATUSES.map((status) => (
        <section key={status} className="column">
          <h3>{status}</h3>
          {props.items.filter((task) => task.status === status).map((task) => (
            <article key={task.id} className="kcard">
              <Link href={task.href}><strong>{task.title}</strong></Link>
              <div className="sub">{cadenceLabel(task.workKind)} · {task.owner.name} · {task.dueDate ?? "마감 없음"}</div>
              {canWrite(props.role) ? (
                <select className="control mutate" aria-label={`${task.title} 상태`} value={task.status} onChange={(event) => void changeStatus(task, event.target.value, props.online, props.toast, props.reload)}>
                  {STATUSES.map((item) => <option key={item}>{item}</option>)}
                </select>
              ) : null}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
