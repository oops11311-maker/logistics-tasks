"use client";

import Link from "next/link";
import { roleLabel } from "./api";

export const LINKS = [
  ["/", "대시보드"],
  ["/my", "내 업무"],
  ["/team", "팀 업무"],
  ["/projects", "프로젝트"],
  ["/reports", "보고서"],
  ["/focus", "효율"],
];

export function FrameSide(props: {
  pathname: string;
  today: string;
  name: string;
  role: string;
  onLogout: () => void;
}) {
  return (
    <aside className="side">
      <div className="brand">
        <img src="/icons/icon-192.png" alt="" />
        <div><strong>물류자동화 업무</strong><span>서울 시간 · {props.today}</span></div>
      </div>
      <nav>
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className={props.pathname === href ? "active" : ""}>{label}</Link>
        ))}
        {props.role === "admin" ? <Link href="/admin" className={props.pathname === "/admin" ? "active" : ""}>관리</Link> : null}
      </nav>
      <div className="meta">
        <div>{props.name} · {roleLabel(props.role)}</div>
        <button className="btn" type="button" onClick={props.onLogout}>로그아웃</button>
      </div>
    </aside>
  );
}
