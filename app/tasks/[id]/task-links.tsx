"use client";

import { type Task } from "@/components/api";

export function TaskLinks(props: {
  task: Task;
  editable: boolean;
  online: boolean;
  onUpdate: <K extends keyof Task>(key: K, value: Task[K]) => void;
}) {
  const { task } = props;
  return (
    <>
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
    </>
  );
}
