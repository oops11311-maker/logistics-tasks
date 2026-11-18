"use client";

import { canWrite, type Task } from "@/components/api";
import { changeCadence, changeStatus, TaskTables } from "@/components/bits";

export { shiftMonth, TeamCalendar } from "@/app/team/calendar";
export { TeamKanban } from "@/app/team/kanban";

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
