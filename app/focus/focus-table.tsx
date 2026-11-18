"use client";

import { ratio, type FocusPerson } from "@/app/focus/person";
import { State } from "@/components/bits";

export function FocusTable(props: {
  people: FocusPerson[];
  openId: string | null;
  onOpen: (id: string) => void;
}) {
  if (props.people.length === 0) return <State kind="empty">집계할 멤버가 없습니다.</State>;
  return (
    <div className="table-wrap">
      <table className="board">
        <thead>
          <tr>
            <th>담당</th><th>열림</th><th>지연</th><th>이번 주 완료</th><th>기한 내</th><th>반복 이행</th><th>주력 프로젝트</th>
          </tr>
        </thead>
        <tbody>
          {props.people.map((item) => (
            <tr key={item.id} className={props.openId === item.id ? "active" : ""}>
              <td><button className="btn" onClick={() => props.onOpen(item.id)}>{item.name}</button></td>
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
  );
}
