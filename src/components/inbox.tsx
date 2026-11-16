"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useApp } from "./shell";

type Note = { id: string; taskId: string | null; title: string; body: string; readAt: string | null; createdAt: string };

export function Inbox() {
  const { online, toast, refresh } = useApp();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState("");
  function load() {
    api<{ notifications: Note[] }>("/api/notifications").then((data) => setNotes(data.notifications)).catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : "알림을 불러오지 못했습니다."));
  }
  useEffect(load, []);
  if (error) return <div className="error"><p>{error}</p><button className="solid" onClick={load}>다시 시도</button></div>;
  if (!notes) return <p className="loading">불러오는 중</p>;
  return (
    <div className="grid">
      <div className="row">
        <h1 className="grow" style={{ margin: 0 }}>알림</h1>
        <button className="quiet" disabled={!online} onClick={() => api("/api/notifications/read-all", { method: "POST" }).then(() => { toast("모두 읽음으로 표시했습니다."); load(); return refresh(); }).catch((reason: unknown) => toast(reason instanceof ApiError ? reason.message : "표시하지 못했습니다.", false))}>모두 읽음</button>
      </div>
      <p className="meta">앱 안 알림만 사용합니다. 메일이나 메신저로 보내지 않습니다.</p>
      {notes.length === 0 ? <p className="empty">알림이 없습니다.</p> : notes.map((note) => (
        <article key={note.id} className="card">
          <strong>{note.title}</strong>
          <p>{note.body}</p>
          <div className="row">
            {note.taskId ? <Link href={`/tasks/${note.taskId}`}>작업 열기</Link> : null}
            {!note.readAt ? <button className="quiet" disabled={!online} onClick={() => api(`/api/notifications/${note.id}/read`, { method: "POST" }).then(() => { load(); return refresh(); }).catch(() => toast("읽음 처리에 실패했습니다.", false))}>읽음</button> : <span className="meta">읽음</span>}
          </div>
        </article>
      ))}
    </div>
  );
}
