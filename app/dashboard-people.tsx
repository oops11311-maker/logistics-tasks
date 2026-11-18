"use client";

import Link from "next/link";
import { formatWhen } from "@/components/api";

export function DashboardPeople(props: {
  byAssignee: { id: string; name: string; open: number; overdue: number }[];
  recent: { id: string; href: string; title: string; actorName: string; actorKind: string; createdAt: string | null }[];
}) {
  return (
    <section className="panel">
      <h2>담당자별</h2>
      {props.byAssignee.length === 0 ? <p className="state">멤버가 없습니다.</p> : props.byAssignee.map((row) => (
        <Link key={row.id} href={`/team?assigneeId=${row.id}`} className="item">
          <span>{row.name}</span>
          <span className="sub">진행 {row.open} · 지연 {row.overdue}</span>
        </Link>
      ))}
      <h2>최근 변경</h2>
      {props.recent.length === 0 ? <p className="state">변경이 없습니다.</p> : props.recent.map((row) => (
        <Link key={row.id} href={row.href} className="item">
          <span>{row.title}</span>
          <span className="sub">{row.actorName} · {row.actorKind === "bot" ? "봇" : "사람"} · {formatWhen(row.createdAt)}</span>
        </Link>
      ))}
    </section>
  );
}
