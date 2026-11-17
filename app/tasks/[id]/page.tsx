"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, canWrite, formatWhen, PRIORITIES, STATUSES, type Task } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

type Detail = {
  task: Task;
  comments: { id: string; body: string; kind: string; createdAt: string | null; author: { name: string } }[];
  events: { id: string; action: string; field: string | null; oldValue: string | null; newValue: string | null; actorKind: string; actorName: string; createdAt: string | null }[];
};

const ACTION: Record<string, string> = { create: "생성", status: "상태", assignee: "담당자", due: "마감", trash: "휴지통", restore: "복원", complete: "완료", reopen: "다시 열기" };

export default function TaskPage() {
  const params = useParams<{ id: string }>();
  const { categories, members, me, online, toast, revision, setDirty, reload } = useApp();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");

  function load() {
    setLoading(true);
    setError("");
    api<Detail>(`/api/tasks/${params.id}`)
      .then((data) => {
        setDetail(data);
        setDirty(false);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [params.id, revision]);

  if (loading && !detail) return <State kind="loading">불러오는 중…</State>;
  if (error) return <State kind="error" onRetry={load}>{error}</State>;
  if (!detail) return <State kind="empty">업무를 찾지 못했습니다.</State>;
  const task = detail.task;
  const editable = canWrite(me.role) && (me.role !== "member" || task.owner.id === me.id || task.collaborators.some((person) => person.id === me.id));

  function update<K extends keyof Task>(key: K, value: Task[K]) {
    setDetail((current) => current ? { ...current, task: { ...current.task, [key]: value } } : current);
    setDirty(true);
  }

  async function save() {
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      const saved = await api<Detail>(`/api/tasks/${task.id}`, {
        method: "PATCH",
        mutate: true,
        body: JSON.stringify({
          version: task.version,
          title: task.title,
          body: task.body,
          categoryId: task.categoryId,
          ownerId: task.owner.id,
          collaboratorIds: task.collaborators.map((person) => person.id),
          startDate: task.startDate,
          dueDate: task.dueDate,
          dueTime: task.dueTime,
          priority: task.priority,
          status: task.status,
          checklist: task.checklist,
          tags: task.tags,
          links: task.links,
          holdReason: task.holdReason,
          delayReason: task.delayReason,
          workKind: task.workKind,
        }),
      });
      setDetail(saved);
      setDirty(false);
      toast("저장했습니다.");
      reload();
    } catch (reason) {
      toast(reason instanceof ApiError ? reason.message : "저장하지 못했습니다.");
      if (reason instanceof ApiError && reason.status === 409) load();
    }
  }

  async function act(path: string) {
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      const saved = await api<Detail>(path, { method: "POST", mutate: true, body: JSON.stringify({ version: task.version }) });
      setDetail(saved);
      toast("저장했습니다.");
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
    }
  }

  async function sendComment(event: React.FormEvent) {
    event.preventDefault();
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      await api(`/api/tasks/${task.id}/comments`, { method: "POST", mutate: true, body: JSON.stringify({ body: comment }) });
      setComment("");
      toast("저장했습니다.");
      load();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
    }
  }

  return (
    <div className="cards-2">
      <section className="panel">
        <p className="hint"><Link href="/team">팀 업무</Link> · {task.href}</p>
        <label className="stack">제목
          <input className="field" value={task.title} disabled={!editable || !online} onChange={(event) => update("title", event.target.value)} />
        </label>
        <label className="stack">본문
          <textarea className="field" value={task.body} disabled={!editable || !online} onChange={(event) => update("body", event.target.value)} />
        </label>
        <div className="filters">
          <label className="stack">프로젝트
            <select className="control" value={task.categoryId ?? ""} disabled={!editable || !online} onChange={(event) => update("categoryId", event.target.value || null)}>
              <option value="">없음</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="stack">담당
            <select className="control" value={task.owner.id} disabled={!editable || !online} onChange={(event) => update("owner", { id: event.target.value, name: members.find((person) => person.id === event.target.value)?.name ?? "", email: "" })}>
              {members.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </label>
          <label className="stack">상태
            <select className="control" value={task.status} disabled={!editable || !online} onChange={(event) => update("status", event.target.value)}>
              {STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label className="stack">우선순위
            <select className="control" value={task.priority} disabled={!editable || !online} onChange={(event) => update("priority", event.target.value)}>
              {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
          <label className="stack">구분
            <select className="control" value={task.workKind} disabled={!editable || !online} onChange={(event) => update("workKind", event.target.value === "daily" ? "daily" : "once")}>
              <option value="daily">데일리업무</option>
              <option value="once">1회성 업무</option>
            </select>
          </label>
          <label className="stack">시작
            <input className="field" type="date" value={task.startDate ?? ""} disabled={!editable || !online} onChange={(event) => update("startDate", event.target.value || null)} />
          </label>
          <label className="stack">마감
            <input className="field" type="date" value={task.dueDate ?? ""} disabled={!editable || !online} onChange={(event) => update("dueDate", event.target.value || null)} />
          </label>
          <label className="stack">마감 시각
            <input className="field" type="time" value={task.dueTime ?? ""} disabled={!editable || !online} onChange={(event) => update("dueTime", event.target.value || null)} />
          </label>
        </div>
        <p className="hint">시각을 비우면 서울 시간으로 그날 23:59까지입니다.</p>
        <label className="stack">보류 사유
          <input className="field" value={task.holdReason ?? ""} disabled={!editable || !online} onChange={(event) => update("holdReason", event.target.value)} />
        </label>
        <label className="stack">지연 사유
          <input className="field" value={task.delayReason ?? ""} disabled={!editable || !online} onChange={(event) => update("delayReason", event.target.value)} />
        </label>
        <label className="stack">협업자
          <select className="control" multiple value={task.collaborators.map((person) => person.id)} disabled={!editable || !online} onChange={(event) => {
            const ids = [...event.target.selectedOptions].map((option) => option.value);
            update("collaborators", ids.map((id) => ({ id, name: members.find((person) => person.id === id)?.name ?? "", email: "" })));
          }}>
            {members.filter((person) => person.id !== task.owner.id).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
        <h2>체크리스트</h2>
        {task.checklist.map((item, index) => (
          <label key={item.id} className="check">
            <input type="checkbox" checked={item.done} disabled={!editable || !online} onChange={(event) => {
              const checklist = task.checklist.slice();
              checklist[index] = { ...item, done: event.target.checked };
              update("checklist", checklist);
            }} />
            {item.text}
          </label>
        ))}
        {editable ? (
          <form className="filters" onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const input = form.elements.namedItem("item") as HTMLInputElement;
            if (!input.value.trim()) return;
            update("checklist", [...task.checklist, { id: crypto.randomUUID(), text: input.value.trim(), done: false }]);
            input.value = "";
          }}>
            <input className="field grow" name="item" aria-label="체크 항목" placeholder="항목 추가" disabled={!online} />
            <button className="btn mutate" disabled={!online}>추가</button>
          </form>
        ) : null}
        <h2>관련 주소</h2>
        {task.links.map((link) => <div key={link.url}><a href={link.url} target="_blank" rel="noreferrer noopener">{link.label || link.url}</a></div>)}
        {editable ? (
          <form className="filters" onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const url = (form.elements.namedItem("url") as HTMLInputElement).value.trim();
            const label = (form.elements.namedItem("label") as HTMLInputElement).value.trim();
            if (!url) return;
            update("links", [...task.links, { url, label }]);
            form.reset();
          }}>
            <input className="field grow" name="url" aria-label="주소" placeholder="https://" disabled={!online} />
            <input className="field" name="label" aria-label="링크 이름" placeholder="이름" disabled={!online} />
            <button className="btn mutate" disabled={!online}>추가</button>
          </form>
        ) : null}
        <label className="stack">태그
          <input className="field" value={task.tags.join(", ")} disabled={!editable || !online} onChange={(event) => update("tags", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />
        </label>
        <p className="hint">만든 사람 {task.creator.name} · 생성 {formatWhen(task.createdAt)} · 수정 {formatWhen(task.updatedAt)} · 완료 {formatWhen(task.completedAt)}</p>
        {task.recurrence ? <p className="hint">반복 {task.recurrence.freq} · 다음 {task.recurrence.nextRunOn ?? "중지"}</p> : null}
        <div className="row">
          {editable ? <button className="btn primary mutate" disabled={!online} onClick={() => void save()}>저장</button> : null}
          {editable && task.status !== "완료" ? <button className="btn mutate" disabled={!online} onClick={() => void act(`/api/tasks/${task.id}/complete`)}>완료</button> : null}
          {editable && task.status === "완료" ? <button className="btn mutate" disabled={!online} onClick={() => void act(`/api/tasks/${task.id}/reopen`)}>다시 열기</button> : null}
          {editable && !task.deletedAt ? <button className="btn danger mutate" disabled={!online} onClick={() => void act(`/api/tasks/${task.id}/trash`)}>휴지통</button> : null}
          {editable && task.deletedAt ? <button className="btn mutate" disabled={!online} onClick={() => void act(`/api/tasks/${task.id}/restore`)}>복원</button> : null}
          {editable && task.recurrence?.active ? <button className="btn mutate" disabled={!online} onClick={() => void act(`/api/tasks/${task.id}/recurrence/stop`)}>반복 중지</button> : null}
        </div>
      </section>
      <section className="panel">
        <h2>댓글</h2>
        {detail.comments.length === 0 ? <p className="state">댓글이 없습니다.</p> : detail.comments.map((item) => (
          <article key={item.id} className="item">
            <div>
              <div className="title">{item.author.name} · {item.kind === "proposal" ? "제안" : item.kind === "progress_check" ? "진행 확인" : "댓글"}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{item.body}</div>
            </div>
            <span className="sub">{formatWhen(item.createdAt)}</span>
          </article>
        ))}
        {canWrite(me.role) ? (
          <form onSubmit={(event) => void sendComment(event)}>
            <textarea className="field" aria-label="댓글" placeholder="@이름으로 멘션" value={comment} onChange={(event) => setComment(event.target.value)} />
            <button className="btn primary mutate" disabled={!online}>댓글 남기기</button>
          </form>
        ) : null}
        <h2>변경 기록</h2>
        {detail.events.length === 0 ? <p className="state">기록이 없습니다.</p> : detail.events.map((event) => (
          <div key={event.id} className="item">
            <span>{ACTION[event.action] ?? event.action} · {showValue(event.oldValue)} → {showValue(event.newValue)}</span>
            <span className="sub">{event.actorName} · {event.actorKind === "bot" ? "봇" : "사람"} · {formatWhen(event.createdAt)}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function showValue(value: string | null): string {
  if (!value) return "없음";
  try {
    const parsed = JSON.parse(value) as { name?: string };
    if (parsed && typeof parsed === "object" && parsed.name) return parsed.name;
  } catch {
    /* 저장된 문장을 그대로 보여 준다. */
  }
  return value;
}
