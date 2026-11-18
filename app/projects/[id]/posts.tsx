"use client";

import Link from "next/link";
import { CADENCES, cadenceLabel, formatWhen, type Person, type Task } from "@/components/api";
import { State } from "@/components/bits";

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
      <div className="filters">
        <label className="stack">마감
          <input className="field" type="date" value={props.due} onChange={(event) => props.onDue(event.target.value)} />
        </label>
        <label className="stack">구분
          <select className="control" value={props.kind} onChange={(event) => props.onKind(event.target.value as Task["workKind"])}>
            {CADENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {props.admin ? (
          <label className="stack">담당
            <select className="control" multiple aria-label="담당자" value={props.assignees} onChange={(event) => props.onAssignees([...event.target.selectedOptions].map((option) => option.value))}>
              {props.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
        ) : null}
        <button className="btn primary mutate" disabled={!props.online}>올리기</button>
      </div>
    </form>
  );
}

export function PostTable({ posts }: { posts: Task[] }) {
  if (posts.length === 0) return <State kind="empty">아직 글이 없습니다.</State>;
  const names = (task: Task) => [task.owner.name, ...task.collaborators.map((person) => person.name)].join(", ");
  return (
    <div className="table-wrap">
      <table className="board">
        <thead>
          <tr><th>제목</th><th>담당</th><th>구분</th><th>상태</th><th>마감</th><th>올린 시각</th></tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id} className={post.overdue ? "late" : ""}>
              <td><Link href={post.href}>{post.title}</Link><span className="sub">{post.body ? post.body.slice(0, 80) : "본문 없음"}</span></td>
              <td>{names(post)}</td>
              <td>{cadenceLabel(post.workKind)}</td>
              <td>{post.status}</td>
              <td>{post.dueDate ?? "—"}</td>
              <td>{formatWhen(post.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
