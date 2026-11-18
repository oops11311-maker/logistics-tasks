"use client";

import { type Person, type Task } from "@/components/api";
import { TaskActions } from "@/app/tasks/[id]/task-actions";
import { TaskChecklist } from "@/app/tasks/[id]/task-checklist";
import { TaskLinks } from "@/app/tasks/[id]/task-links";

export function TaskExtras(props: {
  task: Task;
  members: Person[];
  people: Person[];
  role: string;
  editable: boolean;
  online: boolean;
  onUpdate: <K extends keyof Task>(key: K, value: Task[K]) => void;
  onSave: () => void;
  onAct: (path: string) => void;
}) {
  const { task } = props;
  const locked = !props.editable || !props.online;
  return (
    <>
      <label className="stack">보류 사유
        <input className="field" value={task.holdReason ?? ""} disabled={locked} onChange={(event) => props.onUpdate("holdReason", event.target.value)} />
      </label>
      <label className="stack">지연 사유
        <input className="field" value={task.delayReason ?? ""} disabled={locked} onChange={(event) => props.onUpdate("delayReason", event.target.value)} />
      </label>
      <label className="stack">협업자
        <select className="control" multiple value={task.collaborators.map((person) => person.id)} disabled={props.role !== "admin" || !props.online} onChange={(event) => {
          const ids = [...event.target.selectedOptions].map((option) => option.value);
          props.onUpdate("collaborators", ids.map((id) => ({ id, name: props.members.find((person) => person.id === id)?.name ?? "", email: "" })));
        }}>
          {props.people.filter((person) => person.id !== task.owner.id).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
      </label>
      <TaskChecklist task={task} editable={props.editable} online={props.online} locked={locked} onUpdate={props.onUpdate} />
      <TaskLinks task={task} editable={props.editable} online={props.online} onUpdate={props.onUpdate} />
      <TaskActions task={task} editable={props.editable} online={props.online} locked={locked} onUpdate={props.onUpdate} onSave={props.onSave} onAct={props.onAct} />
    </>
  );
}
