"use client";

import Link from "next/link";
import { EditorFields } from "@/app/tasks/[id]/editor-fields";
import { TaskExtras } from "@/app/tasks/[id]/extras";
import { type Category, type Person, type Task } from "@/components/api";

export function TaskEditor(props: {
  task: Task;
  categories: Category[];
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
    <section className="panel">
      <p className="hint"><Link href="/team">팀 업무</Link> · {task.href}</p>
      <label className="stack">제목
        <input className="field" value={task.title} disabled={locked} onChange={(event) => props.onUpdate("title", event.target.value)} />
      </label>
      <label className="stack">본문
        <textarea className="field" value={task.body} disabled={locked} onChange={(event) => props.onUpdate("body", event.target.value)} />
      </label>
      <EditorFields task={task} categories={props.categories} members={props.members} people={props.people} role={props.role} locked={locked} online={props.online} onUpdate={props.onUpdate} />
      <p className="hint">시각을 비우면 서울 시간으로 그날 23:59까지입니다.</p>
      <TaskExtras task={task} members={props.members} people={props.people} role={props.role} editable={props.editable} online={props.online} onUpdate={props.onUpdate} onSave={props.onSave} onAct={props.onAct} />
    </section>
  );
}
