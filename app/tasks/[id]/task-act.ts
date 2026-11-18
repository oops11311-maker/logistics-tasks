import { api } from "@/components/api";
import { type Detail } from "@/app/tasks/[id]/task-save";

export async function actOnTask(input: {
  path: string;
  version: number;
  online: boolean;
  toast: (message: string) => void;
  reload: () => void;
  setDetail: (value: Detail) => void;
}) {
  if (!input.online) return input.toast("오프라인 상태에서는 편집할 수 없습니다.");
  try {
    const saved = await api<Detail>(input.path, { method: "POST", mutate: true, body: JSON.stringify({ version: input.version }) });
    input.setDetail(saved);
    input.toast("저장했습니다.");
    input.reload();
  } catch (reason) {
    input.toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
  }
}
