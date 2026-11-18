"use client";

import { HolidayFields } from "@/app/admin/holidays";
import { DAYS, type AdminState, type Settings } from "@/app/admin/types";
import { api } from "@/components/api";

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

  async function save() {
    if (!props.online) return props.toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      const settings = await api<Settings>("/api/admin/settings", {
        method: "PUT",
        mutate: true,
        body: JSON.stringify({ ...props.data.settings, holidays: props.data.holidays }),
      });
      props.onData({ ...props.data, settings });
      props.toast("저장했습니다.");
    } catch (reason) {
      props.toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
      props.reload();
    }
  }

  const { data } = props;
  return (
    <section className="panel">
      <h2>봇 범위와 주기</h2>
      <div className="filters">
        <label className="stack">평일 요약 시각
          <input className="field" type="time" value={data.settings.bot.summaryTime} onChange={(event) => patchSettings((settings) => { settings.bot.summaryTime = event.target.value; })} />
        </label>
        <label className="stack">주간 초안 시각
          <input className="field" type="time" value={data.settings.bot.weeklyTime} onChange={(event) => patchSettings((settings) => { settings.bot.weeklyTime = event.target.value; })} />
        </label>
        <label className="stack">주간 요일
          <select className="control" value={data.settings.bot.weeklyWeekday} onChange={(event) => patchSettings((settings) => { settings.bot.weeklyWeekday = Number(event.target.value); })}>
            {DAYS.map(([label, value]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="stack">마감 전 영업일
          <input className="field" type="number" min={0} max={14} value={data.settings.bot.dueSoonBusinessDays} onChange={(event) => patchSettings((settings) => { settings.bot.dueSoonBusinessDays = Number(event.target.value); })} />
        </label>
        <label className="stack">미갱신 영업일
          <input className="field" type="number" min={1} max={30} value={data.settings.bot.staleBusinessDays} onChange={(event) => patchSettings((settings) => { settings.bot.staleBusinessDays = Number(event.target.value); })} />
        </label>
      </div>
      <div className="row">
        {DAYS.map(([label, value]) => (
          <label key={value} className="check">
            <input type="checkbox" checked={data.settings.bot.summaryWeekdays.includes(value)} onChange={(event) => patchSettings((settings) => {
              settings.bot.summaryWeekdays = event.target.checked
                ? [...settings.bot.summaryWeekdays, value]
                : settings.bot.summaryWeekdays.filter((day) => day !== value);
            })} />
            요약 {label}
          </label>
        ))}
      </div>
      <p className="hint">기본값: 평일 09:00 오늘·지연 요약, 마감 1영업일 전 알림, 지연 알림, 진행 중 3영업일 미갱신, 목요일 15:00 주간 초안.</p>
      <p className="hint">봇 범위. 아무 것도 고르지 않으면 전체 프로젝트입니다.</p>
      <div className="row">
        {data.categories.filter((category) => !category.archived).map((category) => (
          <label key={category.id} className="check">
            <input type="checkbox" checked={data.settings.bot.categoryIds.includes(category.id)} onChange={(event) => patchSettings((settings) => {
              settings.bot.categoryIds = event.target.checked
                ? [...settings.bot.categoryIds, category.id]
                : settings.bot.categoryIds.filter((id) => id !== category.id);
            })} />
            {category.name}
          </label>
        ))}
      </div>
      <h2>알림</h2>
      <label className="check"><input type="checkbox" checked disabled />앱 안 알림 (항상 사용)</label>
      <label className="check"><input type="checkbox" checked={data.settings.notifications.dueSoon} onChange={(event) => patchSettings((settings) => { settings.notifications.dueSoon = event.target.checked; })} />마감 전 알림</label>
      <label className="check"><input type="checkbox" checked={data.settings.notifications.overdue} onChange={(event) => patchSettings((settings) => { settings.notifications.overdue = event.target.checked; })} />지연 알림</label>
      <label className="check"><input type="checkbox" checked={data.settings.notifications.stale} onChange={(event) => patchSettings((settings) => { settings.notifications.stale = event.target.checked; })} />미갱신 알림</label>
      <label className="check"><input type="checkbox" checked={data.settings.notifications.mentions} onChange={(event) => patchSettings((settings) => { settings.notifications.mentions = event.target.checked; })} />멘션</label>
      <p className="hint">{data.integration.pushNote}</p>
      <HolidayFields exclude={data.settings.excludeHolidays} holidays={data.holidays} patch={patchSettings} />
      <button className="btn primary mutate" disabled={!props.online} onClick={() => void save()}>설정 저장</button>
    </section>
  );
}
