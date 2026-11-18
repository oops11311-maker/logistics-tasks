"use client";

import { formatWhen, type Person, type Task } from "@/components/api";

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
      <h2>체크리스트</h2>
      {task.checklist.map((item, index) => (
        <label key={item.id} className="check">
          <input type="checkbox" checked={item.done} disabled={locked} onChange={(event) => {
            const checklist = task.checklist.slice();
            checklist[index] = { ...item, done: event.target.checked };
            props.onUpdate("checklist", checklist);
          }} />
          {item.text}
        </label>
      ))}
      {props.editable ? (
        <form className="filters" onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const input = form.elements.namedItem("item") as HTMLInputElement;
          if (!input.value.trim()) return;
          props.onUpdate("checklist", [...task.checklist, { id: crypto.randomUUID(), text: input.value.trim(), done: false }]);
          input.value = "";
        }}>
          <input className="field grow" name="item" aria-label="체크 항목" placeholder="항목 추가" disabled={!props.online} />
          <button className="btn mutate" disabled={!props.online}>추가</button>
        </form>
      ) : null}
      <h2>관련 주소</h2>
      {task.links.map((link) => <div key={link.url}><a href={link.url} target="_blank" rel="noreferrer noopener">{link.label || link.url}</a></div>)}
      {props.editable ? (
        <form className="filters" onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const url = (form.elements.namedItem("url") as HTMLInputElement).value.trim();
          const label = (form.elements.namedItem("label") as HTMLInputElement).value.trim();
          if (!url) return;
          props.onUpdate("links", [...task.links, { url, label }]);
          form.reset();
        }}>
          <input className="field grow" name="url" aria-label="주소" placeholder="https://" disabled={!props.online} />
          <input className="field" name="label" aria-label="링크 이름" placeholder="이름" disabled={!props.online} />
          <button className="btn mutate" disabled={!props.online}>추가</button>
        </form>
      ) : null}
      <label className="stack">태그
        <input className="field" value={task.tags.join(", ")} disabled={locked} onChange={(event) => props.onUpdate("tags", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />
      </label>
      <p className="hint">만든 사람 {task.creator.name} · 생성 {formatWhen(task.createdAt)} · 수정 {formatWhen(task.updatedAt)} · 완료 {formatWhen(task.completedAt)}</p>
      {task.recurrence ? <p className="hint">반복 {task.recurrence.freq} · 다음 {task.recurrence.nextRunOn ?? "중지"}</p> : null}
      <div className="row">
        {props.editable ? <button className="btn primary mutate" disabled={!props.online} onClick={props.onSave}>저장</button> : null}
        {props.editable && task.status !== "완료" ? <button className="btn mutate" disabled={!props.online} onClick={() => props.onAct(`/api/tasks/${task.id}/complete`)}>완료</button> : null}
        {props.editable && task.status === "완료" ? <button className="btn mutate" disabled={!props.online} onClick={() => props.onAct(`/api/tasks/${task.id}/reopen`)}>다시 열기</button> : null}
        {props.editable && !task.deletedAt ? <button className="btn danger mutate" disabled={!props.online} onClick={() => props.onAct(`/api/tasks/${task.id}/trash`)}>휴지통</button> : null}
        {props.editable && task.deletedAt ? <button className="btn mutate" disabled={!props.online} onClick={() => props.onAct(`/api/tasks/${task.id}/restore`)}>복원</button> : null}
        {props.editable && task.recurrence?.active ? <button className="btn mutate" disabled={!props.online} onClick={() => props.onAct(`/api/tasks/${task.id}/recurrence/stop`)}>반복 중지</button> : null}
      </div>
    </>
  );
}
