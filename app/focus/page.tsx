"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

type Person = {
  id: string;
  name: string;
  href: string;
  open: number;
  overdue: number;
  doneThisWeek: number;
  doneWithDue: number;
  onTime: number;
  onceOpen: number;
  dailyOpen: number;
  weeklyOpen: number;
  monthlyOpen: number;
  yearlyOpen: number;
  repeatDue: number;
  repeatDone: number;
  projects: number;
  topProject: string | null;
  topProjectCount: number;
};

type Focus = {
  week: { start: string; end: string };
  note: string;
  people: Person[];
};

export default function FocusPage() {
  const { revision } = useApp();
  const [data, setData] = useState<Focus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError("");
    api<Focus>("/api/focus")
      .then((payload) => {
        setData(payload);
        setOpen((current) => current ?? payload.people[0]?.id ?? null);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [revision]);

  if (loading && !data) return <State kind="loading">불러오는 중…</State>;
  if (error) return <State kind="error" onRetry={load}>{error}</State>;
  if (!data) return <State kind="empty">집계가 없습니다.</State>;
  const person = data.people.find((item) => item.id === open) ?? data.people[0];

  return (
    <div className="list">
      <p className="hint">서울 {data.week.start}–{data.week.end}. {data.note}</p>
      {data.people.length === 0 ? <State kind="empty">집계할 멤버가 없습니다.</State> : (
        <div className="table-wrap">
          <table className="board">
            <thead>
              <tr>
                <th>담당</th><th>열림</th><th>지연</th><th>이번 주 완료</th><th>기한 내</th><th>반복 이행</th><th>주력 프로젝트</th>
              </tr>
            </thead>
            <tbody>
              {data.people.map((item) => (
                <tr key={item.id} className={person?.id === item.id ? "active" : ""}>
                  <td><button className="btn" onClick={() => setOpen(item.id)}>{item.name}</button></td>
                  <td>{item.open}</td>
                  <td>{item.overdue}</td>
                  <td>{item.doneThisWeek}</td>
                  <td>{ratio(item.onTime, item.doneWithDue)}</td>
                  <td>{ratio(item.repeatDone, item.repeatDue)}</td>
                  <td>{item.open === 0 ? "없음" : `${item.topProject} ${item.topProjectCount}/${item.open}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {person ? (
        <article className="panel article">
          <h2>{person.name}</h2>
          <p className="hint">열린 업무 {person.open}건 가운데 1회성 {person.onceOpen}, 매일 {person.dailyOpen}, 매주 {person.weeklyOpen}, 매월 {person.monthlyOpen}, 매년 {person.yearlyOpen}입니다. 손댄 프로젝트는 {person.projects}개입니다.</p>
          <p>기한 내 완료 {ratio(person.onTime, person.doneWithDue)}. 이번 주 마감인 반복 업무 {ratio(person.repeatDone, person.repeatDue)}.</p>
          <p>업무 집중 {person.open === 0 ? "열린 업무가 없어 계산하지 않습니다." : `${person.topProject}에 ${person.topProjectCount}건, 전체 열린 업무의 ${Math.round((person.topProjectCount / person.open) * 100)}%입니다.`}</p>
          <Link href={person.href}>이 담당자의 업무 목록</Link>
        </article>
      ) : null}
    </div>
  );
}

function ratio(done: number, total: number): string {
  if (total === 0) return "없음";
  return `${done}/${total}`;
}
