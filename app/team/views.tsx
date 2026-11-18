"use client";

import Link from "next/link";
import { cadenceLabel, canWrite, STATUSES, type Task } from "@/components/api";
import { changeCadence, changeStatus, TaskTables } from "@/components/bits";

export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function calendarCells(month: string): string[] {
  const [year, mon] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const cells: string[] = Array.from({ length: offset }, () => "");
  for (let day = 1; day <= last; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  return cells;
}

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

export function TeamCalendar(props: {
  month: string;
  items: Task[];
  onMonth: (month: string) => void;
}) {
  const cells = calendarCells(props.month);
  return (
    <div>
      <div className="row">
        <button className="btn" onClick={() => props.onMonth(shiftMonth(props.month, -1))}>이전 달</button>
        <strong>{props.month} · 서울</strong>
        <button className="btn" onClick={() => props.onMonth(shiftMonth(props.month, 1))}>다음 달</button>
      </div>
      <div className="cal">
        {["월", "화", "수", "목", "금", "토", "일"].map((label) => <div key={label} className="dow">{label}</div>)}
        {cells.map((day, index) => (
          <div key={day || `blank-${index}`} className="day">
            {day ? (
              <>
                <b>{Number(day.slice(8))}</b>
                {props.items.filter((task) => task.dueDate === day).map((task) => <Link key={task.id} href={task.href}>{task.title}</Link>)}
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamList(props: {
  items: Task[];
  role: string;
  online: boolean;
  toast: (message: string) => void;
  reload: () => void;
  selected: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
}) {
  return (
    <TaskTables
      items={props.items}
      writable={canWrite(props.role)}
      selected={props.selected}
      onSelect={props.onSelect}
      onStatus={(task, status) => void changeStatus(task, status, props.online, props.toast, props.reload)}
      onCadence={(task, cadence) => void changeCadence(task, cadence, props.online, props.toast, props.reload)}
    />
  );
}
