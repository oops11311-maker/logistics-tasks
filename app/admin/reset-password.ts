import { type MemberRow } from "@/app/admin/member-diff";
import { api } from "@/components/api";

export async function resetAccountPassword(input: {
  editing: MemberRow | null;
  online: boolean;
  password: string;
  toast: (message: string) => void;
  clear: () => void;
}) {
  if (!input.editing) return;
  if (!input.online) return input.toast("오프라인 상태에서는 편집할 수 없습니다.");
  try {
    await api(`/api/admin/accounts/${input.editing.id}/password`, {
      method: "POST",
      mutate: true,
      body: JSON.stringify({ password: input.password }),
    });
    input.clear();
    input.toast("비밀번호를 다시 지정했습니다. 기존 로그인은 끊깁니다.");
  } catch (reason) {
    input.toast(reason instanceof Error ? reason.message : "비밀번호를 바꾸지 못했습니다.");
  }
}
