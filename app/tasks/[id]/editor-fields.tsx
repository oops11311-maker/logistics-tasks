"use client";

import { EditorDates } from "@/app/tasks/[id]/editor-dates";
import { EditorStatus } from "@/app/tasks/[id]/editor-status";
import { type Category, type Person, type Task } from "@/components/api";

export function EditorFields(props: {
  task: Task;
  categories: Category[];
  members: Person[];
  people: Person[];
  role: string;
  locked: boolean;
  online: boolean;
  onUpdate: <K extends keyof Task>(key: K, value: Task[K]) => void;
}) {
  const { task } = props;
  return (
    <div className="filters">
      <label className="stack">프로젝트
        <select className="control" value={task.categoryId ?? ""} disabled={props.locked} onChange={(event) => props.onUpdate("categoryId", event.target.value || null)}>
          <option value="">없음</option>
          {props.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <label className="stack">담당
        <select className="control" value={task.owner.id} disabled={props.role !== "admin" || !props.online} onChange={(event) => props.onUpdate("owner", { id: event.target.value, name: props.members.find((person) => person.id === event.target.value)?.name ?? "", email: "" })}>
          {props.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </label>
      <EditorStatus task={task} locked={props.locked} onUpdate={props.onUpdate} />
      <EditorDates task={task} locked={props.locked} onUpdate={props.onUpdate} />
    </div>
  );
}
