"use client";

import Link from "next/link";
import { api } from "./api";

type Note = { id: string; href: string | null; title: string; body: string };

export function NoteList(props: { notes: Note[]; online: boolean; onReadAll: () => void }) {
  return (
    <div className="panel note-pop">
      <h2>알림</h2>
      {props.notes.length === 0 ? <p className="state">알림이 없습니다.</p> : props.notes.map((note) => (
        <Link key={note.id} href={note.href ?? "/"} className="item" onClick={() => void api("/api/notifications/read", { method: "POST", mutate: true, body: JSON.stringify({ ids: [note.id] }) })}>
          <span><span className="title">{note.title}</span><span className="sub">{note.body}</span></span>
        </Link>
      ))}
      <button className="btn mutate" disabled={!props.online} onClick={props.onReadAll}>모두 읽음</button>
    </div>
  );
}

export function MoreMenu(props: {
  role: string;
  unread: number;
  install: { prompt: () => Promise<void> } | null;
  onNotes: () => void;
}) {
  return (
    <div className="more">
      <Link href="/projects">프로젝트</Link>
      <Link href="/focus">효율</Link>
      {props.role === "admin" ? <Link href="/admin">관리</Link> : null}
      <button className="navish" type="button" onClick={props.onNotes}>알림 {props.unread}</button>
      {props.install ? <button className="navish" type="button" onClick={() => void props.install?.prompt()}>앱 설치</button> : <p className="hint">브라우저 메뉴에서 홈 화면에 추가하세요.</p>}
    </div>
  );
}
