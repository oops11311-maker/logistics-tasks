"use client";

import { BotDays } from "@/app/admin/bot-days";
import { DAYS, type Settings } from "@/app/admin/types";

export function BotTimes(props: {
  settings: Settings;
  patch: (recipe: (settings: Settings, holidays: { day: string; name: string }[]) => void) => void;
}) {
  const bot = props.settings.bot;
  return (
    <>
      <div className="filters">
        <label className="stack">평일 요약 시각
          <input className="field" type="time" value={bot.summaryTime} onChange={(event) => props.patch((settings) => { settings.bot.summaryTime = event.target.value; })} />
        </label>
        <label className="stack">주간 초안 시각
          <input className="field" type="time" value={bot.weeklyTime} onChange={(event) => props.patch((settings) => { settings.bot.weeklyTime = event.target.value; })} />
        </label>
        <label className="stack">주간 요일
          <select className="control" value={bot.weeklyWeekday} onChange={(event) => props.patch((settings) => { settings.bot.weeklyWeekday = Number(event.target.value); })}>
            {DAYS.map(([label, value]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="stack">마감 전 영업일
          <input className="field" type="number" min={0} max={14} value={bot.dueSoonBusinessDays} onChange={(event) => props.patch((settings) => { settings.bot.dueSoonBusinessDays = Number(event.target.value); })} />
        </label>
        <label className="stack">미갱신 영업일
          <input className="field" type="number" min={1} max={30} value={bot.staleBusinessDays} onChange={(event) => props.patch((settings) => { settings.bot.staleBusinessDays = Number(event.target.value); })} />
        </label>
      </div>
      <BotDays weekdays={bot.summaryWeekdays} patch={props.patch} />
    </>
  );
}
