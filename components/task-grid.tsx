"use client";

import { type Task } from "./api";
import { TaskRow } from "./task-row";

export function TaskGrid(props: {
  items: Task[];
  writable: boolean;
  selected?: Set<string>;
  onSelect?: (id: string, checked: boolean) => void;
  onStatus?: (task: Task, status: string) => void;
  onCadence?: (task: Task, cadence: string) => void;
}) {
  return (
    <div className="table-wrap only-pc">
      <table className="grid">
        <thead>
          <tr>
            {props.onSelect ? <th /> : null}
            <th>제목</th><th>반복</th><th>프로젝트</th><th>담당</th><th>상태</th><th>우선순위</th><th>마감</th>
          </tr>
        </thead>
        <tbody>
          {props.items.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              writable={props.writable}
              selected={props.selected?.has(task.id)}
              onSelect={props.onSelect}
              onStatus={props.onStatus}
              onCadence={props.onCadence}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
