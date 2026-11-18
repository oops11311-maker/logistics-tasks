"use client";

import { api, STATUSES, type Person, type Task } from "@/components/api";

export async function applyBulk(input: {
  kind: "status" | "owner";
  items: Task[];
  selected: Set<string>;
  bulkStatus: string;
  bulkOwner: string;
  online: boolean;
  toast: (message: string) => void;
  reload: () => void;
  clear: () => void;
}) {
  if (!input.online) return input.toast("오프라인 상태에서는 편집할 수 없습니다.");
  const versions: Record<string, number> = {};
  for (const task of input.items) if (input.selected.has(task.id)) versions[task.id] = task.version;
  const holdReason = input.kind === "status" && input.bulkStatus === "보류" ? window.prompt("보류 사유") : undefined;
  const body = input.kind === "status"
    ? { ids: [...input.selected], versions, status: input.bulkStatus, holdReason }
    : { ids: [...input.selected], versions, ownerId: input.bulkOwner };
  if (input.kind === "status" && input.bulkStatus === "보류" && !body.holdReason) return;
  try {
    const result = await api<{ results: { ok: boolean; message?: string }[] }>("/api/tasks/bulk", {
      method: "POST",
      mutate: true,
      body: JSON.stringify(body),
    });
    const failed = result.results.filter((item) => !item.ok).length;
    input.toast(failed ? `${failed}건은 저장하지 못했습니다.` : "저장했습니다.");
    input.clear();
    input.reload();
  } catch (reason) {
    input.toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
  }
}

export function BulkBar(props: {
  role: string;
  online: boolean;
  members: Person[];
  bulkStatus: string;
  bulkOwner: string;
  onStatus: (value: string) => void;
  onOwner: (value: string) => void;
  onApply: (kind: "status" | "owner") => void;
}) {
  return (
    <div className="filters">
      <select className="control" value={props.bulkStatus} onChange={(event) => props.onStatus(event.target.value)} aria-label="일괄 상태">
        {STATUSES.map((status) => <option key={status}>{status}</option>)}
      </select>
      <button className="btn mutate" disabled={!props.online} onClick={() => props.onApply("status")}>상태 적용</button>
      {props.role === "admin" ? (
        <>
          <select className="control" value={props.bulkOwner} onChange={(event) => props.onOwner(event.target.value)} aria-label="일괄 담당자">
            <option value="">담당자</option>
            {props.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          <button className="btn mutate" disabled={!props.online || !props.bulkOwner} onClick={() => props.onApply("owner")}>담당 적용</button>
        </>
      ) : null}
    </div>
  );
}
