"use client";

import Link from "next/link";

export function DashboardStats(props: { today: number; overdue: number; week: number; review: number }) {
  return (
    <div className="cards-4">
      <Link className="panel stat" href="/my"><b>{props.today}</b><span>오늘 마감</span></Link>
      <Link className="panel stat" href="/team?due=overdue"><b>{props.overdue}</b><span>내 지연</span></Link>
      <Link className="panel stat" href="/my"><b>{props.week}</b><span>이번 주</span></Link>
      <Link className="panel stat" href={`/team?status=${encodeURIComponent("확인 요청")}`}><b>{props.review}</b><span>확인 요청</span></Link>
    </div>
  );
}
