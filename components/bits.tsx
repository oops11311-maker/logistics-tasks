"use client";

import { api, ApiError, type Task } from "./api";

export function State({ kind, children, onRetry }: { kind: "loading" | "empty" | "error"; children: string; onRetry?: () => void }) {
  return (
    <div className="state">
      <p>{children}</p>
      {kind === "error" && onRetry ? <button className="btn" onClick={onRetry}>다시 시도</button> : null}
    </div>
  );
}

export { TaskTables } from "./task-tables";

export async function changeCadence(task: Task, cadence: string, online: boolean, toast: (message: string) => void, reload: () => void) {
  if (!online) {
    toast("오프라인 상태에서는 편집할 수 없습니다.");
    return;
  }
  try {
    await api(`/api/tasks/${task.id}`, {
      method: "PATCH",
      mutate: true,
      body: JSON.stringify({ version: task.version, workKind: cadence }),
    });
    toast("저장했습니다.");
  } catch (error) {
    toast(error instanceof ApiError ? error.message : "저장하지 못했습니다.");
  }
  reload();
}

export async function changeStatus(task: Task, status: string, online: boolean, toast: (message: string) => void, reload: () => void) {
  if (!online) {
    toast("오프라인 상태에서는 편집할 수 없습니다.");
    return;
  }
  let holdReason = task.holdReason;
  if (status === "보류" && !holdReason) {
    holdReason = window.prompt("보류 사유를 입력하세요.");
    if (!holdReason) return;
  }
  try {
    await api(`/api/tasks/${task.id}`, {
      method: "PATCH",
      mutate: true,
      body: JSON.stringify({ version: task.version, status, holdReason }),
    });
    toast("저장했습니다.");
  } catch (error) {
    toast(error instanceof ApiError ? error.message : "저장하지 못했습니다.");
  }
  reload();
}
