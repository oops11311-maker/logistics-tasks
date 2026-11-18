"use client";

import { FrameMain } from "./frame-main";
import { FrameSide, LINKS } from "./frame-side";

type Note = { id: string; href: string | null; title: string; body: string };
type Me = { name: string; role: string };

export function pageTitle(pathname: string): string {
  return LINKS.find((item) => item[0] === pathname)?.[1]
    ?? (pathname.startsWith("/tasks/") ? "업무" : pathname.startsWith("/admin") ? "관리" : pathname.startsWith("/focus") ? "효율" : "물류자동화 업무");
}

export function AppFrame(props: {
  pathname: string;
  online: boolean;
  today: string;
  me: Me;
  title: string;
  unread: number;
  remote: boolean;
  openNotes: boolean;
  notes: Note[];
  more: boolean;
  message: string;
  install: { prompt: () => Promise<void> } | null;
  children: React.ReactNode;
  onLogout: () => void;
  onNotes: (value: boolean | ((open: boolean) => boolean)) => void;
  onRefresh: () => void;
  onMore: (value: boolean | ((open: boolean) => boolean)) => void;
  onReadAll: () => void;
}) {
  return (
    <div className={props.online ? "app" : "app is-offline"}>
      <FrameSide pathname={props.pathname} today={props.today} name={props.me.name} role={props.me.role} onLogout={props.onLogout} />
      <FrameMain {...props} />
    </div>
  );
}
