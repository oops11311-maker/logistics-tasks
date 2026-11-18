"use client";

import Link from "next/link";
import { formatWhen } from "@/components/api";

export function DashboardSummary(props: {
  summary: { body: string } | null;
  alerts: { id: string; href: string | null; title: string | null; body: string; createdAt: string | null }[];
}) {
  return (
    <section className="panel">
      <h2>봇 요약</h2>
      {props.summary ? <pre className="copy">{props.summary.body}</pre> : <p className="state">아직 봇 요약이 없습니다. 관리 화면에서 실행하거나 웹훅을 호출하세요. 무인 스케줄은 켜져 있지 않습니다.</p>}
      <h2>알림</h2>
      {props.alerts.length === 0 ? <p className="state">알림이 없습니다.</p> : props.alerts.map((alert) => (
        <div key={alert.id} className="item">
          {alert.href ? <Link href={alert.href}>{alert.title ?? alert.body}</Link> : <span>{alert.body}</span>}
          <span className="sub">{formatWhen(alert.createdAt)}</span>
        </div>
      ))}
    </section>
  );
}
