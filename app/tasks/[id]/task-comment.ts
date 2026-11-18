import { api } from "@/components/api";

export async function sendTaskComment(input: {
  event: React.FormEvent;
  online: boolean;
  toast: (message: string) => void;
  taskId: string;
  comment: string;
  clear: () => void;
  load: () => void;
}) {
  input.event.preventDefault();
  if (!input.online) return input.toast("오프라인 상태에서는 편집할 수 없습니다.");
  try {
    await api(`/api/tasks/${input.taskId}/comments`, { method: "POST", mutate: true, body: JSON.stringify({ body: input.comment }) });
    input.clear();
    input.toast("저장했습니다.");
    input.load();
  } catch (reason) {
    input.toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
  }
}
