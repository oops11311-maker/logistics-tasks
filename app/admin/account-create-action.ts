import { api } from "@/components/api";

export async function createAccount(input: {
  event: React.FormEvent;
  online: boolean;
  toast: (message: string) => void;
  username: string;
  name: string;
  role: string;
  password: string;
  clear: () => void;
  reload: () => void;
}) {
  input.event.preventDefault();
  if (!input.online) return input.toast("오프라인 상태에서는 편집할 수 없습니다.");
  try {
    await api("/api/admin/accounts", {
      method: "POST",
      mutate: true,
      body: JSON.stringify({ username: input.username, name: input.name, role: input.role, password: input.password }),
    });
    input.clear();
    input.toast("계정을 만들었습니다. 처음 로그인하면 비밀번호를 바꿔야 합니다.");
    input.reload();
  } catch (reason) {
    input.toast(reason instanceof Error ? reason.message : "계정을 만들지 못했습니다.");
  }
}
