"use client";

import { type Category, type Person } from "@/components/api";

export function FilterPeople(props: {
  q: string;
  assigneeId: string;
  categoryId: string;
  categories: Category[];
  members: Person[];
  onParam: (key: string, value: string) => void;
}) {
  return (
    <>
      <input className="field grow" aria-label="검색" placeholder="제목·본문 검색" defaultValue={props.q} onBlur={(event) => props.onParam("q", event.target.value)} />
      <select className="control" aria-label="담당자" value={props.assigneeId} onChange={(event) => props.onParam("assigneeId", event.target.value)}>
        <option value="">담당자 전체</option>
        {props.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
      <select className="control" aria-label="프로젝트" value={props.categoryId} onChange={(event) => props.onParam("categoryId", event.target.value)}>
        <option value="">프로젝트 전체</option>
        {props.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>
    </>
  );
}
