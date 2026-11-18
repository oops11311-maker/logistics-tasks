"use client";

import { roleLabel } from "./api";

export function FrameHeader(props: {
  title: string;
  name: string;
  role: string;
  today: string;
  unread: number;
  install: { prompt: () => Promise<void> } | null;
  onNotes: (value: boolean | ((open: boolean) => boolean)) => void;
}) {
  return (
    <header className="top">
      <div>
        <h1>{props.title}</h1>
        <div className="who">{props.name} · {roleLabel(props.role)} · 서울 {props.today}</div>
      </div>
      <div className="row">
        {props.install ? (
          <button className="btn" onClick={() => void props.install?.prompt()}>앱 설치</button>
        ) : (
          <span className="hint">홈 화면에 추가할 수 있습니다</span>
        )}
        <button className="btn" onClick={() => props.onNotes((open) => !open)}>알림 {props.unread}</button>
      </div>
    </header>
  );
}
