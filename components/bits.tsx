"use client";

import Link from "next/link";
import { api, ApiError, STATUSES, type Task } from "./api";

export function State({ kind, children, onRetry }: { kind: "loading" | "empty" | "error"; children: string; onRetry?: () => void }) {
  return (
    <div className="state">
      <p>{children}</p>
      {kind === "error" && onRetry ? <button className="btn" onClick={onRetry}>다시 시도</button> : null}
    </div>
  );
}

export function TaskTables({
  items,
  onStatus,
  writable,
  selected,
  onSelect,
}: {
  items: Task[];
  onStatus?: (task: Task, status: string) => void;
  writable: boolean;
  selected?: Set<string>;
  onSelect?: (id: string, checked: boolean) => void;
}) {
  if (items.length === 0) return <State kind="empty">해당하는 업무가 없습니다.</State>;
  return (
    <>
      <div className="table-wrap only-pc">
        <table className="grid">
          <thead>
            <tr>
              {onSelect ? <th /> : null}
              <th>제목</th><th>프로젝트</th><th>담당</th><th>상태</th><th>우선순위</th><th>마감</th>
            </tr>
          </thead>
          <tbody>
            {items.map((task) => (
              <tr key={task.id} className={task.overdue ? "late" : ""}>
                {onSelect ? <td><input type="checkbox" checked={selected?.has(task.id) ?? false} onChange={(event) => onSelect(task.id, event.target.checked)} aria-label={`${task.title} 선택`} /></td> : null}
                <td><Link href={task.href}>{task.title}</Link></td>
                <td>{task.categoryName ?? "—"}</td>
                <td>{task.owner.name}</td>
                <td>{onStatus && writable ? <StatusSelect task={task} onStatus={onStatus} /> : <span className={`chip ${statusClass(task.status)}`}>{task.status}</span>}</td>
                <td><span className={`chip p-${task.priority}`}>{task.priority}</span></td>
                <td>{task.dueDate ?? "—"}{task.dueTime ? ` ${task.dueTime}` : task.dueDate ? " 하루 끝" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cards">
        {items.map((task) => (
          <article key={task.id} className={task.overdue ? "mcard late" : "mcard"}>
            {onSelect ? <label className="check"><input type="checkbox" checked={selected?.has(task.id) ?? false} onChange={(event) => onSelect(task.id, event.target.checked)} />선택</label> : null}
            <Link href={task.href}><strong>{task.title}</strong></Link>
            <div className="sub">{task.categoryName ?? "프로젝트 없음"} · {task.owner.name} · {task.dueDate ?? "마감 없음"}</div>
            <div className="row">
              <span className={`chip p-${task.priority}`}>{task.priority}</span>
              <span className="chip">{task.status}</span>
            </div>
            {onStatus && writable ? <StatusSelect task={task} onStatus={onStatus} /> : null}
          </article>
        ))}
      </div>
    </>
  );
}

function statusClass(status: string): string {
  if (status === "진행 중") return "s-진행";
  if (status === "확인 요청") return "s-확인";
  if (status === "완료") return "s-완료";
  if (status === "보류") return "s-보류";
  return "";
}

function StatusSelect({ task, onStatus }: { task: Task; onStatus: (task: Task, status: string) => void }) {
  return (
    <select className="control mutate" aria-label={`${task.title} 상태`} value={task.status} onChange={(event) => onStatus(task, event.target.value)}>
      {STATUSES.map((status) => <option key={status}>{status}</option>)}
    </select>
  );
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
