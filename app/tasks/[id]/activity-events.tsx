"use client";

import { formatWhen } from "@/components/api";

const ACTION: Record<string, string> = { create: "생성", status: "상태", assignee: "담당자", due: "마감", cadence: "반복", trash: "휴지통", restore: "복원", complete: "완료", reopen: "다시 열기" };

type EventRow = { id: string; action: string; oldValue: string | null; newValue: string | null; actorKind: string; actorName: string; createdAt: string | null };

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

export function ActivityEvents(props: { events: EventRow[] }) {
  return (
    <>
      <h2>변경 기록</h2>
      {props.events.length === 0 ? <p className="state">기록이 없습니다.</p> : props.events.map((event) => (
        <div key={event.id} className="item">
          <span>{ACTION[event.action] ?? event.action} · {showValue(event.oldValue)} → {showValue(event.newValue)}</span>
          <span className="sub">{event.actorName} · {event.actorKind === "bot" ? "봇" : "사람"} · {formatWhen(event.createdAt)}</span>
        </div>
      ))}
    </>
  );
}
