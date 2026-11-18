"use client";

import { CADENCES, type Person, type Task } from "@/components/api";

export function PostFields(props: {
  admin: boolean;
  online: boolean;
  due: string;
  kind: Task["workKind"];
  assignees: string[];
  people: Person[];
  onDue: (value: string) => void;
  onKind: (value: Task["workKind"]) => void;
  onAssignees: (ids: string[]) => void;
}) {
  return (
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
  );
}
