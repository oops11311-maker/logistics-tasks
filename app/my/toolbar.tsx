"use client";

import { CADENCES } from "@/components/api";
import { AddForm } from "@/app/my/add-form";
import { KindFilter } from "@/app/my/kind-filter";
import { type Category } from "@/components/api";

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
      {props.writable ? <AddForm {...props} /> : null}
      <div className="filter-bar">
        <div className="segment" role="tablist" aria-label="기간">
          {TABS.map(([key, label]) => (
            <button key={key} className={props.tab === key ? "tab on" : "tab"} aria-pressed={props.tab === key} onClick={() => props.onTab(key)}>{label}</button>
          ))}
        </div>
        <div className="filter-actions">
          <KindFilter kind={props.kind} open={props.filtersOpen} onOpen={props.onFiltersOpen} onKind={props.onKind} />
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
