"use client";

import Link from "next/link";
import { formatWhen } from "@/components/api";
import { State } from "@/components/bits";

export type ProjectRow = {
  id: string;
  name: string;
  total: number;
  done: number;
  overdue: number;
  progress: number;
  latestTitle: string | null;
  latestAt: string | null;
  latestOwner: string | null;
  linked: number;
};

export function ProjectTable(props: {
  items: ProjectRow[];
  manage: boolean;
  onDelete: (item: ProjectRow) => void;
}) {
  if (props.items.length === 0) return <State kind="empty">게시판이 없습니다.</State>;
  return (
    <div className="table-wrap">
      <table className="board">
        <thead>
          <tr><th>게시판</th><th>글</th><th>진행</th><th>최근 글</th><th>올린 사람</th><th>시각</th>{props.manage ? <th /> : null}</tr>
        </thead>
        <tbody>
          {props.items.map((item) => (
            <tr key={item.id}>
              <td><Link href={`/projects/${item.id}`}>{item.name}</Link></td>
              <td>{item.total}</td>
              <td>완료 {item.done} · 지연 {item.overdue} · {item.total === 0 ? "0%" : `${Math.round(item.progress * 100)}%`}</td>
              <td>{item.latestTitle ?? "글 없음"}</td>
              <td>{item.latestOwner ?? "—"}</td>
              <td>{formatWhen(item.latestAt)}</td>
              {props.manage ? <td><button className="btn" type="button" onClick={() => props.onDelete(item)}>삭제</button></td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { ArchiveDialog } from "@/app/projects/archive-dialog";
