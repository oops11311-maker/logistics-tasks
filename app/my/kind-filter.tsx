"use client";

import { CADENCES } from "@/components/api";

export function KindFilter(props: {
  kind: string;
  open: boolean;
  onOpen: (value: boolean | ((open: boolean) => boolean)) => void;
  onKind: (kind: string) => void;
}) {
  return (
    <div className="filter-pop">
      <button className={props.kind ? "btn on" : "btn"} aria-expanded={props.open} aria-haspopup="dialog" onClick={() => props.onOpen((open) => !open)}>필터</button>
      {props.open ? (
        <div className="filter-menu" role="dialog" aria-label="반복 필터">
          <button className={props.kind === "" ? "tab on" : "tab"} onClick={() => { props.onKind(""); props.onOpen(false); }}>반복 전체</button>
          {CADENCES.map(([value, label]) => (
            <button key={value} className={props.kind === value ? "tab on" : "tab"} onClick={() => { props.onKind(value); props.onOpen(false); }}>{label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
