"use client";

import { applyBulk, BulkBar } from "@/app/team/bulk";
import { TeamFilters } from "@/app/team/filters";
import { canWrite, type Category, type Person, type Task } from "@/components/api";

export function TeamControls(props: {
  view: string;
  q: string;
  assigneeId: string;
  categoryId: string;
  status: string;
  priority: string;
  kind: string;
  due: string;
  categories: Category[];
  members: Person[];
  selected: Set<string>;
  items: Task[];
  role: string;
  online: boolean;
  bulkStatus: string;
  bulkOwner: string;
  toast: (message: string) => void;
  reload: () => void;
  onParam: (key: string, value: string) => void;
  onStatus: (value: string) => void;
  onOwner: (value: string) => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className="tabs">
        {[["list", "목록"], ["kanban", "상태별 보기"], ["calendar", "달력"]].map(([key, label]) => (
          <button key={key} className={props.view === key ? "tab on" : "tab"} onClick={() => props.onParam("view", key)}>{label}</button>
        ))}
      </div>
      <TeamFilters
        q={props.q}
        assigneeId={props.assigneeId}
        categoryId={props.categoryId}
        status={props.status}
        priority={props.priority}
        kind={props.kind}
        due={props.due}
        categories={props.categories}
        members={props.members}
        onParam={props.onParam}
      />
      {props.selected.size > 0 && canWrite(props.role) ? (
        <BulkBar
          role={props.role}
          online={props.online}
          members={props.members}
          bulkStatus={props.bulkStatus}
          bulkOwner={props.bulkOwner}
          onStatus={props.onStatus}
          onOwner={props.onOwner}
          onApply={(kind) => void applyBulk({
            kind, items: props.items, selected: props.selected, bulkStatus: props.bulkStatus, bulkOwner: props.bulkOwner,
            online: props.online, toast: props.toast, reload: props.reload, clear: props.onClear,
          })}
        />
      ) : null}
    </>
  );
}
