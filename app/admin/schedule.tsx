"use client";

import { BotFields } from "@/app/admin/bot-fields";
import { HolidayFields } from "@/app/admin/holidays";
import { NotifyFields } from "@/app/admin/notify-fields";
import { saveSchedule } from "@/app/admin/schedule-save";
import { type AdminState, type Settings } from "@/app/admin/types";

export function ScheduleSection(props: {
  data: AdminState;
  online: boolean;
  toast: (message: string) => void;
  onData: (data: AdminState) => void;
  reload: () => void;
}) {
  function patchSettings(recipe: (settings: Settings, holidays: { day: string; name: string }[]) => void) {
    const settings = structuredClone(props.data.settings);
    const holidays = props.data.holidays.map((item) => ({ ...item }));
    recipe(settings, holidays);
    props.onData({ ...props.data, settings, holidays });
  }

  return (
    <section className="panel">
      <h2>봇 범위와 주기</h2>
      <BotFields settings={props.data.settings} categories={props.data.categories} patch={patchSettings} />
      <NotifyFields settings={props.data.settings} pushNote={props.data.integration.pushNote} patch={patchSettings} />
      <HolidayFields exclude={props.data.settings.excludeHolidays} holidays={props.data.holidays} patch={patchSettings} />
      <button className="btn primary mutate" disabled={!props.online} onClick={() => void saveSchedule(props)}>설정 저장</button>
    </section>
  );
}
