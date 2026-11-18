import { api, ApiError, type Task } from "@/components/api";

type Detail = {
  task: Task;
  comments: { id: string; body: string; kind: string; createdAt: string | null; author: { name: string } }[];
  events: { id: string; action: string; field: string | null; oldValue: string | null; newValue: string | null; actorKind: string; actorName: string; createdAt: string | null }[];
};

export type { Detail };

export async function saveTask(input: {
  task: Task;
  role: string;
  online: boolean;
  toast: (message: string) => void;
  reload: () => void;
  load: () => void;
  setDetail: (value: Detail) => void;
  setDirty: (value: boolean) => void;
}) {
  if (!input.online) return input.toast("오프라인 상태에서는 편집할 수 없습니다.");
  const task = input.task;
  try {
    const saved = await api<Detail>(`/api/tasks/${task.id}`, {
      method: "PATCH",
      mutate: true,
      body: JSON.stringify({
        version: task.version,
        title: task.title,
        body: task.body,
        categoryId: task.categoryId,
        ...(input.role === "admin" ? {
          ownerId: task.owner.id,
          collaboratorIds: task.collaborators.map((person) => person.id),
        } : {}),
        startDate: task.startDate,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        priority: task.priority,
        status: task.status,
        checklist: task.checklist,
        tags: task.tags,
        links: task.links,
        holdReason: task.holdReason,
        delayReason: task.delayReason,
        workKind: task.workKind,
      }),
    });
    input.setDetail(saved);
    input.setDirty(false);
    input.toast("저장했습니다.");
    input.reload();
  } catch (reason) {
    input.toast(reason instanceof ApiError ? reason.message : "저장하지 못했습니다.");
    if (reason instanceof ApiError && reason.status === 409) input.load();
  }
}
