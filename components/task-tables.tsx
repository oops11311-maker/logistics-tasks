"use client";

import { type Task } from "./api";
import { State } from "./bits";
import { TaskCards } from "./task-cards";
import { TaskGrid } from "./task-grid";

export function TaskTables(props: {
  items: Task[];
  onStatus?: (task: Task, status: string) => void;
  onCadence?: (task: Task, cadence: string) => void;
  writable: boolean;
  selected?: Set<string>;
  onSelect?: (id: string, checked: boolean) => void;
}) {
  if (props.items.length === 0) return <State kind="empty">해당하는 업무가 없습니다.</State>;
  return (
    <>
      <TaskGrid {...props} />
      <TaskCards {...props} />
    </>
  );
}
