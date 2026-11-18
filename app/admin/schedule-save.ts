import { type AdminState, type Settings } from "@/app/admin/types";
import { api } from "@/components/api";

export async function saveSchedule(input: {
  data: AdminState;
  online: boolean;
  toast: (message: string) => void;
  onData: (data: AdminState) => void;
  reload: () => void;
}) {
  if (!input.online) return input.toast("오프라인 상태에서는 편집할 수 없습니다.");
  try {
    const settings = await api<Settings>("/api/admin/settings", {
      method: "PUT",
      mutate: true,
      body: JSON.stringify({ ...input.data.settings, holidays: input.data.holidays }),
    });
    input.onData({ ...input.data, settings });
    input.toast("저장했습니다.");
  } catch (reason) {
    input.toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
    input.reload();
  }
}
