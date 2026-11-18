"use client";

import Link from "next/link";
import { ReportLines, type ReportLine } from "@/app/reports/lines";

export function ReportBoard(props: {
  open: string;
  posts: { id: string; title: string; count: number; hint: string }[];
  people: { id: string; name: string; open: number; overdue: number; doneThisWeek: number }[];
  rows: ReportLine[];
  onOpen: (id: string) => void;
}) {
  const current = props.posts.find((post) => post.id === props.open) ?? props.posts[0];
  return (
    <>
      <div className="table-wrap">
        <table className="board">
          <thead>
            <tr><th>글</th><th>건수</th><th>내용</th></tr>
          </thead>
          <tbody>
            {props.posts.map((post) => (
              <tr key={post.id} className={post.id === props.open ? "active" : ""}>
                <td><button className="btn" onClick={() => props.onOpen(post.id)}>{post.title}</button></td>
                <td>{post.count}</td>
                <td>{post.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <article className="panel article">
        <h2>{current.title} {current.count}건</h2>
        <p className="hint">{current.hint}</p>
        {props.open === "people" ? props.people.map((row) => (
          <Link key={row.id} href={`/team?assigneeId=${row.id}`} className="item">
            <span className="title">{row.name}</span>
            <span className="sub">진행 {row.open} · 지연 {row.overdue} · 이번 주 완료 {row.doneThisWeek}</span>
          </Link>
        )) : <ReportLines rows={props.rows} delay={props.open === "overdue"} />}
      </article>
    </>
  );
}
