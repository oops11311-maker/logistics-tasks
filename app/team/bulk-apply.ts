import { api, type Task } from "@/components/api";

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
