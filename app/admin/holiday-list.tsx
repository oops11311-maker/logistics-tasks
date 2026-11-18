"use client";

import { type Settings } from "@/app/admin/settings-type";

export function HolidayList(props: {
  holidays: { day: string; name: string }[];
  patch: (recipe: (settings: Settings, holidays: { day: string; name: string }[]) => void) => void;
}) {
  return (
    <>
      {props.holidays.map((holiday) => (
        <div key={holiday.day} className="item">
          <span>{holiday.day} {holiday.name}</span>
          <button className="btn" type="button" onClick={() => props.patch((_settings, holidays) => {
            const index = holidays.findIndex((item) => item.day === holiday.day);
            if (index >= 0) holidays.splice(index, 1);
          })}>빼기</button>
        </div>
      ))}
    </>
  );
}
