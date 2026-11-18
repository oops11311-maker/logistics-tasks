"use client";

import { PostFields } from "@/app/projects/[id]/post-fields";
import { type Person, type Task } from "@/components/api";

export function PostForm(props: {
  admin: boolean;
  online: boolean;
  title: string;
  body: string;
  due: string;
  kind: Task["workKind"];
  assignees: string[];
  people: Person[];
  onTitle: (value: string) => void;
  onBody: (value: string) => void;
  onDue: (value: string) => void;
  onKind: (value: Task["workKind"]) => void;
  onAssignees: (ids: string[]) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form className="panel" onSubmit={(event) => void props.onSubmit(event)}>
      <h2>글 올리기</h2>
      <p className="hint">{props.admin ? "고른 담당자의 내 업무에 들어갑니다. 비우면 내 업무에 들어갑니다." : "이 글은 내 업무에 들어갑니다. 다른 사람에게 넣으려면 관리자여야 합니다."}</p>
      <input className="field" aria-label="제목" placeholder="제목" value={props.title} onChange={(event) => props.onTitle(event.target.value)} required />
      <textarea className="field" aria-label="본문" placeholder="내용" value={props.body} onChange={(event) => props.onBody(event.target.value)} />
      <PostFields admin={props.admin} online={props.online} due={props.due} kind={props.kind} assignees={props.assignees} people={props.people} onDue={props.onDue} onKind={props.onKind} onAssignees={props.onAssignees} />
    </form>
  );
}
