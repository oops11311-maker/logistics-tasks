"use client";

import Link from "next/link";
import { cadenceLabel, formatWhen, type Task } from "@/components/api";
import { State } from "@/components/bits";

export function PostTable({ posts }: { posts: Task[] }) {
  if (posts.length === 0) return <State kind="empty">아직 글이 없습니다.</State>;
  const names = (task: Task) => [task.owner.name, ...task.collaborators.map((person) => person.name)].join(", ");
  return (
    <div className="table-wrap">
      <table className="board">
        <thead>
          <tr><th>제목</th><th>담당</th><th>구분</th><th>상태</th><th>마감</th><th>올린 시각</th></tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id} className={post.overdue ? "late" : ""}>
              <td><Link href={post.href}>{post.title}</Link><span className="sub">{post.body ? post.body.slice(0, 80) : "본문 없음"}</span></td>
              <td>{names(post)}</td>
              <td>{cadenceLabel(post.workKind)}</td>
              <td>{post.status}</td>
              <td>{post.dueDate ?? "—"}</td>
              <td>{formatWhen(post.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
