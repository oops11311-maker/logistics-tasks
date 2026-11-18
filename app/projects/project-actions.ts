import { api } from "@/components/api";
import { type ProjectRow } from "@/app/projects/board";

export async function archiveProject(input: {
  pending: ProjectRow | null;
  online: boolean;
  toast: (message: string) => void;
  clear: () => void;
  reload: () => void;
}) {
  if (!input.pending) return;
  if (!input.online) return input.toast("오프라인 상태에서는 편집할 수 없습니다.");
  try {
    await api(`/api/categories/${input.pending.id}`, { method: "DELETE", mutate: true });
    input.clear();
    input.toast("게시판을 보관했습니다. 연결된 업무는 그대로입니다.");
    input.reload();
  } catch (reason) {
    input.toast(reason instanceof Error ? reason.message : "보관하지 못했습니다.");
  }
}

export async function addProject(input: {
  event: React.FormEvent;
  online: boolean;
  toast: (message: string) => void;
  name: string;
  clear: () => void;
  reload: () => void;
}) {
  input.event.preventDefault();
  if (!input.online) return input.toast("오프라인 상태에서는 편집할 수 없습니다.");
  try {
    await api("/api/categories", { method: "POST", mutate: true, body: JSON.stringify({ name: input.name }) });
    input.clear();
    input.toast("저장했습니다.");
    input.reload();
  } catch (reason) {
    input.toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
  }
}
