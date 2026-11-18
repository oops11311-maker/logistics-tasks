import { api, type Task } from "@/components/api";

export async function publishPost(input: {
  event: React.FormEvent;
  online: boolean;
  toast: (message: string) => void;
  projectId: string;
  title: string;
  body: string;
  due: string;
  kind: Task["workKind"];
  admin: boolean;
  assignees: string[];
  meId: string;
  clear: () => void;
  reload: () => void;
}) {
  input.event.preventDefault();
  if (!input.online) return input.toast("오프라인 상태에서는 편집할 수 없습니다.");
  try {
    await api(`/api/projects/${input.projectId}/posts`, {
      method: "POST",
      mutate: true,
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        dueDate: input.due || null,
        workKind: input.kind,
        assigneeIds: input.admin && input.assignees.length > 0 ? input.assignees : [input.meId],
      }),
    });
    input.clear();
    input.toast("담당자 업무에 넣었습니다.");
    input.reload();
  } catch (reason) {
    input.toast(reason instanceof Error ? reason.message : "올리지 못했습니다.");
  }
}
