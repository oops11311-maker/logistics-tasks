"use client";

import { formatWhen } from "@/components/api";

const ACTION: Record<string, string> = { create: "생성", status: "상태", assignee: "담당자", due: "마감", cadence: "반복", trash: "휴지통", restore: "복원", complete: "완료", reopen: "다시 열기" };

type Comment = { id: string; body: string; kind: string; createdAt: string | null; author: { name: string } };
type EventRow = { id: string; action: string; field: string | null; oldValue: string | null; newValue: string | null; actorKind: string; actorName: string; createdAt: string | null };

export function TaskActivity(props: {
  comments: Comment[];
  events: EventRow[];
  writable: boolean;
  online: boolean;
  comment: string;
  onComment: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <section className="panel">
      <h2>댓글</h2>
      {props.comments.length === 0 ? <p className="state">댓글이 없습니다.</p> : props.comments.map((item) => (
        <article key={item.id} className="item">
          <div>
            <div className="title">{item.author.name} · {item.kind === "proposal" ? "제안" : item.kind === "progress_check" ? "진행 확인" : "댓글"}</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{item.body}</div>
          </div>
          <span className="sub">{formatWhen(item.createdAt)}</span>
        </article>
      ))}
      {props.writable ? (
        <form onSubmit={(event) => void props.onSubmit(event)}>
          <textarea className="field" aria-label="댓글" placeholder="@이름으로 멘션" value={props.comment} onChange={(event) => props.onComment(event.target.value)} />
          <button className="btn primary mutate" disabled={!props.online}>댓글 남기기</button>
        </form>
      ) : null}
      <h2>변경 기록</h2>
      {props.events.length === 0 ? <p className="state">기록이 없습니다.</p> : props.events.map((event) => (
        <div key={event.id} className="item">
          <span>{ACTION[event.action] ?? event.action} · {showValue(event.oldValue)} → {showValue(event.newValue)}</span>
          <span className="sub">{event.actorName} · {event.actorKind === "bot" ? "봇" : "사람"} · {formatWhen(event.createdAt)}</span>
        </div>
      ))}
    </section>
  );
}

function showValue(value: string | null): string {
  if (!value) return "없음";
  try {
    const parsed = JSON.parse(value) as { name?: string };
    if (parsed && typeof parsed === "object" && parsed.name) return parsed.name;
  } catch {
    /* 저장된 문장을 그대로 보여 준다. */
  }
  return value;
}
