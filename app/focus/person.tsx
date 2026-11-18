import Link from "next/link";

export type FocusPerson = {
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

export function ratio(done: number, total: number): string {
  if (total === 0) return "없음";
  return `${done}/${total}`;
}

export function FocusDetail({ person }: { person: FocusPerson }) {
  return (
    <article className="panel article">
      <h2>{person.name}</h2>
      <p className="hint">열린 업무 {person.open}건 가운데 1회성 {person.onceOpen}, 매일 {person.dailyOpen}, 매주 {person.weeklyOpen}, 매월 {person.monthlyOpen}, 매년 {person.yearlyOpen}입니다. 손댄 프로젝트는 {person.projects}개입니다.</p>
      <p>기한 내 완료 {ratio(person.onTime, person.doneWithDue)}. 이번 주 마감인 반복 업무 {ratio(person.repeatDone, person.repeatDue)}.</p>
      <p>업무 집중 {person.open === 0 ? "열린 업무가 없어 계산하지 않습니다." : `${person.topProject}에 ${person.topProjectCount}건, 전체 열린 업무의 ${Math.round((person.topProjectCount / person.open) * 100)}%입니다.`}</p>
      <Link href={person.href}>이 담당자의 업무 목록</Link>
    </article>
  );
}
