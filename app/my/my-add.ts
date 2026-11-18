import { api } from "@/components/api";

export async function addMine(input: {
  event: React.FormEvent;
  online: boolean;
  toast: (message: string) => void;
  addKind: string;
  due: string;
  title: string;
  categoryId: string;
  priority: string;
  clearTitle: () => void;
  load: () => void;
}) {
  input.event.preventDefault();
  if (!input.online) return input.toast("오프라인 상태에서는 편집할 수 없습니다.");
  if (input.addKind !== "once" && !input.due) return input.toast("반복 업무에는 마감일이 필요합니다.");
  try {
    await api("/api/tasks", {
      method: "POST",
      mutate: true,
      body: JSON.stringify({ title: input.title, dueDate: input.due || null, categoryId: input.categoryId || null, priority: input.priority, workKind: input.addKind }),
    });
    input.clearTitle();
    input.toast("저장했습니다.");
    input.load();
  } catch (reason) {
    input.toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
  }
}
