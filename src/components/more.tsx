"use client";

import Link from "next/link";
import { useApp } from "./shell";

export function More() {
  const { me } = useApp();
  const links = [
    ["/projects", "프로젝트"],
    ["/inbox", "알림"],
    ["/reports", "보고서"],
    ...(me.member.role === "admin" ? [["/admin", "관리"]] : []),
  ];
  return (
    <div className="grid">
      <h1 style={{ margin: 0 }}>더보기</h1>
      <p className="meta">{me.member.name} · {me.member.email}</p>
      {links.map(([href, label]) => <Link key={href} className="card" href={href} style={{ textDecoration: "none" }}><strong>{label}</strong></Link>)}
    </div>
  );
}
