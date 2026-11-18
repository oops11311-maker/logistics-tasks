"use client";

import Link from "next/link";
import { type Task } from "@/components/api";

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
