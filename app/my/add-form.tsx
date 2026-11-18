"use client";

import { CADENCES, PRIORITIES, type Category } from "@/components/api";

export function AddForm(props: {
  online: boolean;
  categories: Category[];
  title: string;
  due: string;
  categoryId: string;
  priority: string;
  addKind: string;
  onTitle: (value: string) => void;
  onDue: (value: string) => void;
  onCategory: (value: string) => void;
  onPriority: (value: string) => void;
  onAddKind: (value: string) => void;
  onAdd: (event: React.FormEvent) => void;
}) {
  return (
    <form className="filters" onSubmit={(event) => void props.onAdd(event)}>
      <input className="field grow" aria-label="제목" placeholder="빠른 추가" value={props.title} onChange={(event) => props.onTitle(event.target.value)} required />
      <input className="field" aria-label="마감일" type="date" value={props.due} onChange={(event) => props.onDue(event.target.value)} />
      <select className="control" aria-label="프로젝트" value={props.categoryId} onChange={(event) => props.onCategory(event.target.value)}>
        <option value="">프로젝트</option>
        {props.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>
      <select className="control" aria-label="우선순위" value={props.priority} onChange={(event) => props.onPriority(event.target.value)}>
        {PRIORITIES.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select className="control" aria-label="반복" value={props.addKind} onChange={(event) => props.onAddKind(event.target.value)}>
        {CADENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button className="btn primary mutate" disabled={!props.online}>추가</button>
    </form>
  );
}
