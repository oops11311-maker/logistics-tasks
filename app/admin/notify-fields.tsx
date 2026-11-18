"use client";

import { type Settings } from "@/app/admin/settings-type";

export function NotifyFields(props: {
  settings: Settings;
  pushNote: string;
  patch: (recipe: (settings: Settings, holidays: { day: string; name: string }[]) => void) => void;
}) {
  const notes = props.settings.notifications;
  return (
    <>
      <h2>알림</h2>
      <label className="check"><input type="checkbox" checked disabled />앱 안 알림 (항상 사용)</label>
      <label className="check"><input type="checkbox" checked={notes.dueSoon} onChange={(event) => props.patch((settings) => { settings.notifications.dueSoon = event.target.checked; })} />마감 전 알림</label>
      <label className="check"><input type="checkbox" checked={notes.overdue} onChange={(event) => props.patch((settings) => { settings.notifications.overdue = event.target.checked; })} />지연 알림</label>
      <label className="check"><input type="checkbox" checked={notes.stale} onChange={(event) => props.patch((settings) => { settings.notifications.stale = event.target.checked; })} />미갱신 알림</label>
      <label className="check"><input type="checkbox" checked={notes.mentions} onChange={(event) => props.patch((settings) => { settings.notifications.mentions = event.target.checked; })} />멘션</label>
      <p className="hint">{props.pushNote}</p>
    </>
  );
}
