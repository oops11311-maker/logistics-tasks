"use client";

import Link from "next/link";
import { CADENCES, PRIORITIES, STATUSES, type Category, type Person, type Task } from "@/components/api";
import { TaskExtras } from "@/app/tasks/[id]/extras";

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
      <div className="filters">
        <label className="stack">프로젝트
          <select className="control" value={task.categoryId ?? ""} disabled={locked} onChange={(event) => props.onUpdate("categoryId", event.target.value || null)}>
            <option value="">없음</option>
            {props.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="stack">담당
          <select className="control" value={task.owner.id} disabled={props.role !== "admin" || !props.online} onChange={(event) => props.onUpdate("owner", { id: event.target.value, name: props.members.find((person) => person.id === event.target.value)?.name ?? "", email: "" })}>
            {props.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
        <label className="stack">상태
          <select className="control" value={task.status} disabled={locked} onChange={(event) => props.onUpdate("status", event.target.value)}>
            {STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label className="stack">우선순위
          <select className="control" value={task.priority} disabled={locked} onChange={(event) => props.onUpdate("priority", event.target.value)}>
            {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
          </select>
        </label>
        <label className="stack">반복
          <select className="control" value={task.workKind} disabled={locked} onChange={(event) => props.onUpdate("workKind", event.target.value as Task["workKind"])}>
            {CADENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="stack">시작
          <input className="field" type="date" value={task.startDate ?? ""} disabled={locked} onChange={(event) => props.onUpdate("startDate", event.target.value || null)} />
        </label>
        <label className="stack">마감
          <input className="field" type="date" value={task.dueDate ?? ""} disabled={locked} onChange={(event) => props.onUpdate("dueDate", event.target.value || null)} />
        </label>
        <label className="stack">마감 시각
          <input className="field" type="time" value={task.dueTime ?? ""} disabled={locked} onChange={(event) => props.onUpdate("dueTime", event.target.value || null)} />
        </label>
      </div>
      <p className="hint">시각을 비우면 서울 시간으로 그날 23:59까지입니다.</p>
      <TaskExtras task={task} members={props.members} people={props.people} role={props.role} editable={props.editable} online={props.online} onUpdate={props.onUpdate} onSave={props.onSave} onAct={props.onAct} />
    </section>
  );
}
