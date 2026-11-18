"use client";

import { type Task } from "@/components/api";

export function TaskChecklist(props: {
  task: Task;
  editable: boolean;
  online: boolean;
  locked: boolean;
  onUpdate: <K extends keyof Task>(key: K, value: Task[K]) => void;
}) {
  const { task } = props;
  return (
    <>
      <h2>체크리스트</h2>
      {task.checklist.map((item, index) => (
        <label key={item.id} className="check">
          <input type="checkbox" checked={item.done} disabled={props.locked} onChange={(event) => {
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
    </>
  );
}
