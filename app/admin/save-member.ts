import { type MemberRow } from "@/app/admin/member-diff";
import { api } from "@/components/api";

export async function saveMemberEdits(input: {
  editing: MemberRow | null;
  draft: MemberRow | null;
  online: boolean;
  toast: (message: string) => void;
  done: () => void;
  reload: () => void;
}) {
  if (!input.editing || !input.draft) return;
  if (!input.online) return input.toast("오프라인 상태에서는 편집할 수 없습니다.");
  const editing = input.editing;
  const draft = input.draft;
  const body: Record<string, unknown> = {};
  if (editing.name !== draft.name) body.name = draft.name;
  if ((editing.username ?? "") !== (draft.username ?? "")) body.username = draft.username ?? "";
  if (editing.email !== draft.email) body.email = draft.email;
  if (editing.role !== draft.role) body.role = draft.role;
  if (editing.active !== draft.active) body.active = draft.active;
  try {
    await api(`/api/admin/members/${editing.id}`, { method: "PATCH", mutate: true, body: JSON.stringify(body) });
    input.toast("저장했습니다.");
    input.done();
    input.reload();
  } catch (reason) {
    input.toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
  }
}
