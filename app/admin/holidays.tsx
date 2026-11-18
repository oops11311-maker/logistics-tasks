"use client";

import { useState } from "react";
import { HolidayList } from "@/app/admin/holiday-list";
import { type Settings } from "@/app/admin/settings-type";

export function HolidayFields(props: {
  exclude: boolean;
  holidays: { day: string; name: string }[];
  patch: (recipe: (settings: Settings, holidays: { day: string; name: string }[]) => void) => void;
}) {
  const [holidayDay, setHolidayDay] = useState("");
  const [holidayName, setHolidayName] = useState("");
  return (
    <>
      <h2>공휴일 제외</h2>
      <label className="check">
        <input type="checkbox" checked={props.exclude} onChange={(event) => props.patch((settings) => { settings.excludeHolidays = event.target.checked; })} />
        공휴일 제외
      </label>
      <p className="hint">기본은 꺼져 있습니다. 끄면 월–금요일만 영업일입니다. 켜면 아래 날짜도 영업일에서 뺍니다.</p>
      <div className="filters">
        <input className="field" type="date" aria-label="공휴일" value={holidayDay} onChange={(event) => setHolidayDay(event.target.value)} />
        <input className="field" aria-label="공휴일 이름" placeholder="이름" value={holidayName} onChange={(event) => setHolidayName(event.target.value)} />
        <button className="btn" type="button" onClick={() => {
          if (!holidayDay || !holidayName.trim()) return;
          props.patch((_settings, holidays) => { holidays.push({ day: holidayDay, name: holidayName.trim() }); });
          setHolidayDay("");
          setHolidayName("");
        }}>날짜 추가</button>
      </div>
      <HolidayList holidays={props.holidays} patch={props.patch} />
    </>
  );
}
