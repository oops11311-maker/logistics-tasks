"use client";

import { CADENCES, PRIORITIES, type Category } from "@/components/api";

const TABS = [
  ["today", "오늘"],
  ["week", "이번 주"],
  ["all", "전체"],
  ["done", "완료"],
] as const;

export type MyTab = (typeof TABS)[number][0];

export function MyToolbar(props: {
  writable: boolean;
  online: boolean;
  categories: Category[];
  title: string;
  due: string;
  categoryId: string;
  priority: string;
  addKind: string;
  tab: MyTab;
  kind: string;
  filtersOpen: boolean;
  onTitle: (value: string) => void;
  onDue: (value: string) => void;
  onCategory: (value: string) => void;
  onPriority: (value: string) => void;
  onAddKind: (value: string) => void;
  onAdd: (event: React.FormEvent) => void;
  onTab: (tab: MyTab) => void;
  onKind: (kind: string) => void;
  onFiltersOpen: (value: boolean | ((open: boolean) => boolean)) => void;
  onReset: () => void;
}) {
  const timeLabel = TABS.find(([key]) => key === props.tab)?.[1] ?? "전체";
  const kindLabel = CADENCES.find(([value]) => value === props.kind)?.[1] ?? "";
  const filtered = props.tab !== "all" || props.kind !== "";
  return (
    <>
      {props.writable ? (
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
      ) : null}
      <div className="filter-bar">
        <div className="segment" role="tablist" aria-label="기간">
          {TABS.map(([key, label]) => (
            <button key={key} className={props.tab === key ? "tab on" : "tab"} aria-pressed={props.tab === key} onClick={() => props.onTab(key)}>{label}</button>
          ))}
        </div>
        <div className="filter-actions">
          <div className="filter-pop">
            <button className={props.kind ? "btn on" : "btn"} aria-expanded={props.filtersOpen} aria-haspopup="dialog" onClick={() => props.onFiltersOpen((open) => !open)}>필터</button>
            {props.filtersOpen ? (
              <div className="filter-menu" role="dialog" aria-label="반복 필터">
                <button className={props.kind === "" ? "tab on" : "tab"} onClick={() => { props.onKind(""); props.onFiltersOpen(false); }}>반복 전체</button>
                {CADENCES.map(([value, label]) => (
                  <button key={value} className={props.kind === value ? "tab on" : "tab"} onClick={() => { props.onKind(value); props.onFiltersOpen(false); }}>{label}</button>
                ))}
              </div>
            ) : null}
          </div>
          <button className="btn" disabled={!filtered} onClick={props.onReset}>초기화</button>
        </div>
      </div>
      {filtered ? (
        <div className="filter-chips">
          {props.tab !== "all" ? <button className="chip" onClick={() => props.onTab("all")}>{timeLabel} ×</button> : null}
          {kindLabel ? <button className="chip" onClick={() => props.onKind("")}>{kindLabel} ×</button> : null}
        </div>
      ) : null}
    </>
  );
}
