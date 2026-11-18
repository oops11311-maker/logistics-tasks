"use client";

import { TeamControls } from "@/app/team/team-controls";
import { TeamResults } from "@/app/team/team-results";
import { type Category, type Person, type Task } from "@/components/api";

export function TeamScreen(props: {
  params: { get(key: string): string | null };
  view: string;
  month: string;
  categories: Category[];
  members: Person[];
  selected: Set<string>;
  items: Task[];
  role: string;
  online: boolean;
  loading: boolean;
  error: string;
  bulkStatus: string;
  bulkOwner: string;
  toast: (message: string) => void;
  reload: () => void;
  onParam: (key: string, value: string) => void;
  onStatus: (value: string) => void;
  onOwner: (value: string) => void;
  onClear: () => void;
  onRetry: () => void;
  onMonth: (month: string) => void;
  onSelect: (id: string, checked: boolean) => void;
}) {
  const q = props.params.get("q") ?? "";
  const assigneeId = props.params.get("assigneeId") ?? "";
  const categoryId = props.params.get("categoryId") ?? "";
  const status = props.params.get("status") ?? "";
  const priority = props.params.get("priority") ?? "";
  const kind = props.params.get("kind") ?? "";
  const due = props.params.get("due") ?? "";
  return (
    <div>
      <TeamControls view={props.view} q={q} assigneeId={assigneeId} categoryId={categoryId} status={status} priority={priority} kind={kind} due={due} categories={props.categories} members={props.members} selected={props.selected} items={props.items} role={props.role} online={props.online} bulkStatus={props.bulkStatus} bulkOwner={props.bulkOwner} toast={props.toast} reload={props.reload} onParam={props.onParam} onStatus={props.onStatus} onOwner={props.onOwner} onClear={props.onClear} />
      <TeamResults loading={props.loading} error={props.error} view={props.view} month={props.month} items={props.items} role={props.role} online={props.online} toast={props.toast} reload={props.reload} selected={props.selected} onRetry={props.onRetry} onMonth={props.onMonth} onSelect={props.onSelect} />
    </div>
  );
}
