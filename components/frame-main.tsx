"use client";

import { FrameHeader } from "./frame-header";
import { MoreMenu, NoteList } from "./frame-menus";
import { FrameTabs } from "./frame-tabs";

type Note = { id: string; href: string | null; title: string; body: string };
type Me = { name: string; role: string };

export function FrameMain(props: {
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
  pathname: string;
  onNotes: (value: boolean | ((open: boolean) => boolean)) => void;
  onRefresh: () => void;
  onMore: (value: boolean | ((open: boolean) => boolean)) => void;
  onReadAll: () => void;
}) {
  return (
    <>
      <div className="main">
        <FrameHeader title={props.title} name={props.me.name} role={props.me.role} today={props.today} unread={props.unread} install={props.install} onNotes={props.onNotes} />
        {!props.online ? <div className="banner bad">오프라인 상태입니다. 연결되면 다시 편집할 수 있습니다.</div> : null}
        {props.remote ? (
          <div className="banner">
            다른 변경이 있습니다.
            <button className="btn" onClick={props.onRefresh}>새로고침</button>
          </div>
        ) : null}
        {props.openNotes ? <NoteList notes={props.notes} online={props.online} onReadAll={props.onReadAll} /> : null}
        <div className="content">{props.children}</div>
      </div>
      <FrameTabs pathname={props.pathname} onMore={props.onMore} />
      {props.more ? <MoreMenu role={props.me.role} unread={props.unread} install={props.install} onNotes={() => props.onNotes(true)} /> : null}
      {props.message ? <div className="toast">{props.message}</div> : null}
    </>
  );
}
