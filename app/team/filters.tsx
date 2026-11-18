"use client";

import { CADENCES, PRIORITIES, STATUSES, type Category, type Person } from "@/components/api";

export function TeamFilters(props: {
  q: string;
  assigneeId: string;
  categoryId: string;
  status: string;
  priority: string;
  kind: string;
  due: string;
  categories: Category[];
  members: Person[];
  onParam: (key: string, value: string) => void;
}) {
  return (
    <form className="filters" onSubmit={(event) => event.preventDefault()}>
      <input className="field grow" aria-label="검색" placeholder="제목·본문 검색" defaultValue={props.q} onBlur={(event) => props.onParam("q", event.target.value)} />
      <select className="control" aria-label="담당자" value={props.assigneeId} onChange={(event) => props.onParam("assigneeId", event.target.value)}>
        <option value="">담당자 전체</option>
        {props.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select>
      <select className="control" aria-label="프로젝트" value={props.categoryId} onChange={(event) => props.onParam("categoryId", event.target.value)}>
        <option value="">프로젝트 전체</option>
        {props.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>
      <select className="control" aria-label="상태" value={props.status} onChange={(event) => props.onParam("status", event.target.value)}>
        <option value="">상태 전체</option>
        {STATUSES.map((status) => <option key={status}>{status}</option>)}
      </select>
      <select className="control" aria-label="우선순위" value={props.priority} onChange={(event) => props.onParam("priority", event.target.value)}>
        <option value="">우선순위 전체</option>
        {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
      </select>
      <select className="control" aria-label="반복" value={props.kind} onChange={(event) => props.onParam("kind", event.target.value)}>
        <option value="">반복 전체</option>
        {CADENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select className="control" aria-label="마감" value={props.due} onChange={(event) => props.onParam("due", event.target.value)}>
        <option value="">마감 전체</option>
        <option value="today">오늘</option>
        <option value="week">이번 주</option>
        <option value="overdue">지연</option>
        <option value="next">다음 주</option>
      </select>
    </form>
  );
}
