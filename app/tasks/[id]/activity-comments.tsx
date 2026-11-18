"use client";

import { formatWhen } from "@/components/api";

type Comment = { id: string; body: string; kind: string; createdAt: string | null; author: { name: string } };

export function ActivityComments(props: {
  comments: Comment[];
  writable: boolean;
  online: boolean;
  comment: string;
  onComment: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <>
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
    </>
  );
}
