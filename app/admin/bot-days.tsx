"use client";

import { DAYS, type Settings } from "@/app/admin/types";

export function BotDays(props: {
  weekdays: number[];
  patch: (recipe: (settings: Settings, holidays: { day: string; name: string }[]) => void) => void;
}) {
  return (
    <div className="row">
      {DAYS.map(([label, value]) => (
        <label key={value} className="check">
          <input type="checkbox" checked={props.weekdays.includes(value)} onChange={(event) => props.patch((settings) => {
            settings.bot.summaryWeekdays = event.target.checked
              ? [...settings.bot.summaryWeekdays, value]
              : settings.bot.summaryWeekdays.filter((day) => day !== value);
          })} />
          요약 {label}
        </label>
      ))}
    </div>
  );
}
