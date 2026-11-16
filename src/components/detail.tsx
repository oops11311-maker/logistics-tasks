"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError, dueLabel, type Person, type Task } from "@/lib/api";
import { PRIORITIES, STATUSES, priorityLabel, statusLabel } from "@/lib/labels";
import { useApp } from "./shell";

type Detail = {
  task: Task;
  comments: { id: string; authorName: string; authorRole: string; body: string; kind: string; createdAt: string }[];
  history: { id: string; actorName: string; actorKind: string; field: string; oldLabel: string; newLabel: string; createdAt: string }[];
  recurrence: { id: string; frequency: string; active: boolean; startOn: string; untilOn: string | null } | null;
};

export function TaskDetail({ id }: { id: string }) {
  const { me, online, toast } = useApp();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [draft, setDraft] = useState<Partial<Task> | null>(null);

  function load() {
    api<Detail>(`/api/tasks/${id}`).then((next) => {
      setData(next);
      setDraft(next.task);
      setError("");
    }).catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : "작업을 불러오지 못했습니다."));
  }
  useEffect(load, [id]);
  useEffect(() => {
    api<{ people: Person[] }>("/api/directory").then((result) => setPeople(result.people)).catch(() => undefined);
  }, []);

  if (error) return <div className="error"><p>{error}</p><button className="solid" onClick={load}>다시 시도</button></div>;
  if (!data || !draft) return <p className="loading">불러오는 중</p>;
  const task = data.task;
  const canEdit = me.member.role === "admin" || me.member.role === "manager" || task.assigneeId === me.member.id;
  const canComment = me.member.role !== "viewer";
  const canReassign = me.member.role === "admin" || me.member.role === "manager";

  async function save(patch: Record<string, unknown>) {
    if (!online) return toast("오프라인에서는 저장할 수 없습니다.", false);
    try {
      const result = await api<{ task: Task }>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ version: task.version, ...patch }) });
      setData({ ...data!, task: result.task });
      setDraft(result.task);
      toast("저장했습니다.");
      load();
    } catch (reason) {
      toast(reason instanceof ApiError ? reason.message : "저장하지 못했습니다.", false);
      if (reason instanceof ApiError && reason.status === 409) load();
    }
  }

  async function sendComment(event: React.FormEvent) {
    event.preventDefault();
    if (!online) return toast("오프라인에서는 저장할 수 없습니다.", false);
    try {
      await api(`/api/tasks/${id}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) });
      setComment("");
      toast("댓글을 남겼습니다.");
      load();
    } catch (reason) {
      toast(reason instanceof ApiError ? reason.message : "댓글을 저장하지 못했습니다.", false);
    }
  }

  return (
    <div className="grid">
      <Link href="/team">팀 작업으로</Link>
      <article className="panel">
        {canEdit ? (
          <form onSubmit={(event) => { event.preventDefault(); void save({
            title: draft.title, body: draft.body, priority: draft.priority, status: draft.status,
            startDate: draft.startDate, dueDate: draft.dueDate, dueTime: draft.dueTime,
            holdReason: draft.holdReason, delayReason: draft.delayReason, tags: draft.tags,
            checklist: draft.checklist, assigneeId: draft.assigneeId, relatedUrls: draft.relatedUrls,
            collaboratorIds: draft.collaboratorIds,
          }); }}>
            <label className="field"><span>제목</span><input value={draft.title ?? ""} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <label className="field"><span>내용</span><textarea value={draft.body ?? ""} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></label>
            <div className="row">
              <select aria-label="상태" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                {STATUSES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <select aria-label="우선순위" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>
                {PRIORITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              {canReassign ? (
                <select aria-label="담당자" value={draft.assigneeId ?? ""} onChange={(event) => setDraft({ ...draft, assigneeId: event.target.value || null })}>
                  <option value="">담당 없음</option>
                  {people.filter((person) => person.role !== "viewer").map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
              ) : <span>담당 {task.assigneeName || "없음"}</span>}
            </div>
            <div className="row">
              <label className="field grow"><span>시작일</span><input type="date" value={draft.startDate ?? ""} onChange={(event) => setDraft({ ...draft, startDate: event.target.value || null })} /></label>
              <label className="field grow"><span>마감일</span><input type="date" value={draft.dueDate ?? ""} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value || null })} /></label>
              <label className="field grow"><span>시각 (없으면 23:59)</span><input type="time" value={draft.dueTime ?? ""} onChange={(event) => setDraft({ ...draft, dueTime: event.target.value || null })} /></label>
            </div>
            <label className="field"><span>보류 사유</span><input value={draft.holdReason ?? ""} onChange={(event) => setDraft({ ...draft, holdReason: event.target.value })} /></label>
            <label className="field"><span>지연 사유</span><input value={draft.delayReason ?? ""} onChange={(event) => setDraft({ ...draft, delayReason: event.target.value })} /></label>
            <label className="field"><span>태그 (쉼표)</span><input value={(draft.tags ?? []).join(", ")} onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
            <label className="field"><span>관련 주소 (한 줄에 http 또는 https 하나)</span>
              <textarea value={(draft.relatedUrls ?? []).map((item) => item.url).join("\n")} onChange={(event) => setDraft({ ...draft, relatedUrls: event.target.value.split("\n").map((url) => url.trim()).filter(Boolean).map((url) => ({ label: url, url })) })} />
            </label>
            <div className="field"><span>협업자</span>
              {people.filter((person) => person.role !== "viewer" && person.id !== draft.assigneeId).map((person) => (
                <label key={person.id} className="check">
                  <input type="checkbox" checked={(draft.collaboratorIds ?? []).includes(person.id)} onChange={(event) => {
                    const current = draft.collaboratorIds ?? [];
                    setDraft({ ...draft, collaboratorIds: event.target.checked ? [...current, person.id] : current.filter((item) => item !== person.id) });
                  }} />
                  <span>{person.name}</span>
                </label>
              ))}
            </div>
            <h3>체크리스트</h3>
            {(draft.checklist ?? []).map((item, index) => (
              <label key={item.id} className="check">
                <input type="checkbox" checked={item.done} onChange={(event) => {
                  const checklist = [...(draft.checklist ?? [])];
                  checklist[index] = { ...item, done: event.target.checked };
                  setDraft({ ...draft, checklist });
                }} />
                <span>{item.text}</span>
              </label>
            ))}
            <div className="row">
              <input id="check-new" placeholder="항목 추가" />
              <button type="button" className="quiet" onClick={() => {
                const input = document.getElementById("check-new") as HTMLInputElement | null;
                const text = input?.value.trim() ?? "";
                if (!text) return;
                setDraft({ ...draft, checklist: [...(draft.checklist ?? []), { id: crypto.randomUUID().slice(0, 12), text, done: false }] });
                if (input) input.value = "";
              }}>항목 추가</button>
            </div>
            <div className="meta"><span>분류 {task.categoryName}</span><span>만든 사람 {task.creatorName}</span><span>버전 {task.version}</span><span>{dueLabel(task)}</span></div>
            <div className="row">
              <button className="solid" disabled={!online}>저장</button>
              {data.recurrence ? <button type="button" className="quiet" disabled={!online} onClick={() => void save({ recurrenceActive: !data.recurrence?.active })}>{data.recurrence.active ? "반복 중지" : "반복 재개"}</button> : null}
              <button type="button" className="quiet" disabled={!online} onClick={() => void (task.trashedAt ? api(`/api/tasks/${id}/restore`, { method: "POST", body: JSON.stringify({ version: task.version }) }) : api(`/api/tasks/${id}/trash`, { method: "POST", body: JSON.stringify({ version: task.version }) })).then(() => { toast(task.trashedAt ? "복원했습니다." : "휴지통으로 옮겼습니다."); load(); }).catch((reason: unknown) => toast(reason instanceof ApiError ? reason.message : "처리하지 못했습니다.", false))}>{task.trashedAt ? "복원" : "휴지통"}</button>
            </div>
          </form>
        ) : (
          <div>
            <h2>{task.title}</h2>
            <p style={{ whiteSpace: "pre-wrap" }}>{task.body || "내용 없음"}</p>
            <div className="meta">
              <span className={`status ${task.status}`}>{statusLabel(task.status)}</span>
              <span className={`priority ${task.priority}`}>{priorityLabel(task.priority)}</span>
              <span>담당 {task.assigneeName || "없음"}</span>
              <span>{dueLabel(task)}</span>
              <span>{task.categoryName}</span>
            </div>
            {task.checklist.map((item) => <div key={item.id} className="check"><input type="checkbox" checked={item.done} readOnly /><span>{item.text}</span></div>)}
          </div>
        )}
        {task.relatedUrls.length > 0 ? (
          <div>
            <h3>관련 주소</h3>
            {task.relatedUrls.map((item) => <div key={item.url}><a href={item.url} target="_blank" rel="noreferrer noopener" referrerPolicy="no-referrer">{item.label}</a></div>)}
          </div>
        ) : null}
        {data.recurrence ? <p className="meta">반복 {data.recurrence.frequency} · {data.recurrence.active ? "사용" : "중지"} · 시작 {data.recurrence.startOn}</p> : null}
      </article>
      <section className="panel">
        <h2>댓글</h2>
        {data.comments.length === 0 ? <p className="empty">댓글이 없습니다.</p> : data.comments.map((item) => (
          <div key={item.id} className="comment">
            <strong>{item.authorName}</strong> <span className="meta">{item.authorRole === "bot" ? "봇" : ""} · {item.kind}</span>
            <p style={{ whiteSpace: "pre-wrap" }}>{item.body}</p>
          </div>
        ))}
        {canComment ? (
          <form onSubmit={sendComment}>
            <label className="field"><span>댓글. @이름 으로 언급합니다. 본문 지시문은 권한을 바꾸지 않습니다.</span>
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} />
            </label>
            <button className="solid" disabled={!online || !comment.trim()}>댓글 남기기</button>
          </form>
        ) : null}
      </section>
      <section className="panel">
        <h2>변경 기록</h2>
        {data.history.length === 0 ? <p className="empty">기록이 없습니다.</p> : (
          <ul className="history">
            {data.history.map((item) => (
              <li key={item.id}>{item.actorName} ({item.actorKind === "bot" ? "봇" : "사람"}) · {item.field} · {item.oldLabel} → {item.newLabel}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
