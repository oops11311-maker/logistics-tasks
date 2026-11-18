"use client";

import { TeamCalendar, TeamKanban, TeamList } from "@/app/team/views";
import { type Task } from "@/components/api";
import { State } from "@/components/bits";

export function TeamResults(props: {
  loading: boolean;
  error: string;
  view: string;
  month: string;
  items: Task[];
  role: string;
  online: boolean;
  toast: (message: string) => void;
  reload: () => void;
  selected: Set<string>;
  onRetry: () => void;
  onMonth: (month: string) => void;
  onSelect: (id: string, checked: boolean) => void;
}) {
  if (props.loading) return <State kind="loading">불러오는 중…</State>;
  if (props.error) return <State kind="error" onRetry={props.onRetry}>{props.error}</State>;
  if (props.view === "kanban") return <TeamKanban items={props.items} role={props.role} online={props.online} toast={props.toast} reload={props.reload} />;
  if (props.view === "calendar") return <TeamCalendar month={props.month} items={props.items} onMonth={props.onMonth} />;
  return (
    <TeamList
      items={props.items}
      role={props.role}
      online={props.online}
      toast={props.toast}
      reload={props.reload}
      selected={props.selected}
      onSelect={props.onSelect}
    />
  );
}
