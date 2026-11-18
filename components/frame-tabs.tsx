"use client";

import Link from "next/link";

export function FrameTabs(props: {
  pathname: string;
  onMore: (value: boolean | ((open: boolean) => boolean)) => void;
}) {
  return (
    <nav className="tabbar">
      <Link href="/" className={props.pathname === "/" ? "active" : ""}>대시보드</Link>
      <Link href="/my" className={props.pathname === "/my" ? "active" : ""}>내 업무</Link>
      <Link href="/team" className={props.pathname.startsWith("/team") ? "active" : ""}>팀</Link>
      <Link href="/reports" className={props.pathname === "/reports" ? "active" : ""}>보고서</Link>
      <button type="button" onClick={() => props.onMore((open) => !open)}>더보기</button>
    </nav>
  );
}
