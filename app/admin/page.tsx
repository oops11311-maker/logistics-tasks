"use client";

import { useEffect, useState } from "react";
import { api, formatWhen, roleLabel } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

type Settings = {
  revision: number;
  excludeHolidays: boolean;
  bot: {
    summaryTime: string;
    summaryWeekdays: number[];
    dueSoonBusinessDays: number;
    staleBusinessDays: number;
    overdueAlerts: boolean;
    weeklyWeekday: number;
    weeklyTime: string;
    categoryIds: string[];
  };
  notifications: { inApp: boolean; dueSoon: boolean; overdue: boolean; stale: boolean; mentions: boolean };
};
type StatePayload = {
  members: { id: string; name: string; email: string; role: string; active: boolean }[];
  invites: { id: string; email: string; role: string; acceptedAt: string | null }[];
  categories: { id: string; name: string; archived: boolean }[];
  settings: Settings;
  holidays: { day: string; name: string }[];
  jobs: { job: string; label: string; lastSuccessAt: string | null; lastError: string | null; retryCount: number; nextDueAt: string | null; warning: boolean; warningText: string }[];
  runs: { id: string; source: string; job: string; status: string; error: string | null; startedAt: string | null }[];
  integration: { botTokenConfigured: boolean; schedulerTokenConfigured: boolean; unattendedScheduling: boolean; schedulingNote: string; pushNote: string; backupNote: string };
};

const DAYS = [["월", 1], ["화", 2], ["수", 3], ["목", 4], ["금", 5]] as const;

export default function AdminPage() {
  const { me, online, toast, reload } = useApp();
  const [data, setData] = useState<StatePayload | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [holidayDay, setHolidayDay] = useState("");
  const [holidayName, setHolidayName] = useState("");

  function load() {
    api<StatePayload>("/api/admin/state").then(setData).catch((reason: Error) => setError(reason.message));
  }

  useEffect(() => {
    if (me.role === "admin") load();
  }, [me.role]);

  if (me.role !== "admin") return <State kind="error">관리자만 이 화면을 볼 수 있습니다.</State>;
  if (error) return <State kind="error" onRetry={load}>{error}</State>;
  if (!data) return <State kind="loading">불러오는 중…</State>;

  function patchSettings(recipe: (settings: Settings, holidays: { day: string; name: string }[]) => void) {
    if (!data) return;
    const settings = structuredClone(data.settings);
    const holidays = data.holidays.map((item) => ({ ...item }));
    recipe(settings, holidays);
    setData({ ...data, settings, holidays });
  }

  async function save() {
    if (!data || !online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      const settings = await api<Settings>("/api/admin/settings", {
        method: "PUT",
        mutate: true,
        body: JSON.stringify({ ...data.settings, holidays: data.holidays }),
      });
      setData({ ...data, settings });
      toast("저장했습니다.");
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
      load();
    }
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      await api("/api/admin/invites", { method: "POST", mutate: true, body: JSON.stringify({ email, role }) });
      setEmail("");
      toast("저장했습니다.");
      load();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "초대하지 못했습니다.");
    }
  }

  async function runJobs() {
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      await api("/api/admin/jobs/run", { method: "POST", mutate: true, body: "{}" });
      toast("작업을 실행했습니다.");
      load();
      reload();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "실행하지 못했습니다.");
    }
  }

  return (
    <div className="list">
      <section className="panel">
        <h2>멤버와 역할</h2>
        <form className="filters" onSubmit={(event) => void invite(event)}>
          <input className="field grow" type="email" required aria-label="초대 이메일" placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          <select className="control" aria-label="역할" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="admin">관리자</option>
            <option value="manager">매니저</option>
            <option value="member">멤버</option>
            <option value="viewer">뷰어</option>
          </select>
          <button className="btn primary mutate" disabled={!online}>초대</button>
        </form>
        <div className="table-wrap only-pc">
          <table className="grid">
            <thead><tr><th>이름</th><th>이메일</th><th>역할</th><th>상태</th></tr></thead>
            <tbody>
              {data.members.map((member) => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.email}</td>
                  <td>
                    <select className="control mutate" aria-label={`${member.name} 역할`} value={member.role} disabled={!online} onChange={(event) => void api(`/api/admin/members/${member.id}`, { method: "PATCH", mutate: true, body: JSON.stringify({ role: event.target.value }) }).then(() => { toast("저장했습니다."); load(); }).catch((reason: Error) => toast(reason.message))}>
                      <option value="admin">관리자</option>
                      <option value="manager">매니저</option>
                      <option value="member">멤버</option>
                      <option value="viewer">뷰어</option>
                    </select>
                  </td>
                  <td>
                    <button className="btn mutate" disabled={!online} onClick={() => void api(`/api/admin/members/${member.id}`, { method: "PATCH", mutate: true, body: JSON.stringify({ active: !member.active }) }).then(() => { toast("저장했습니다."); load(); }).catch((reason: Error) => toast(reason.message))}>
                      {member.active ? "비활성화" : "다시 활성화"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="cards">
          {data.members.map((member) => (
            <article key={member.id} className="mcard">
              <strong>{member.name}</strong>
              <span>{member.email} · {roleLabel(member.role)}</span>
              <button className="btn mutate" disabled={!online} onClick={() => void api(`/api/admin/members/${member.id}`, { method: "PATCH", mutate: true, body: JSON.stringify({ active: !member.active }) }).then(() => { toast("저장했습니다."); load(); })}>{member.active ? "비활성화" : "다시 활성화"}</button>
            </article>
          ))}
        </div>
        <p className="hint">대기 중 초대 {data.invites.filter((invite) => !invite.acceptedAt).length}건</p>
      </section>
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
        <h2>공휴일 제외</h2>
        <label className="check">
          <input type="checkbox" checked={data.settings.excludeHolidays} onChange={(event) => patchSettings((settings) => { settings.excludeHolidays = event.target.checked; })} />
          공휴일 제외
        </label>
        <p className="hint">기본은 꺼져 있습니다. 끄면 월–금요일만 영업일입니다. 켜면 아래 날짜도 영업일에서 뺍니다.</p>
        <div className="filters">
          <input className="field" type="date" aria-label="공휴일" value={holidayDay} onChange={(event) => setHolidayDay(event.target.value)} />
          <input className="field" aria-label="공휴일 이름" placeholder="이름" value={holidayName} onChange={(event) => setHolidayName(event.target.value)} />
          <button className="btn" type="button" onClick={() => {
            if (!holidayDay || !holidayName.trim()) return;
            patchSettings((_settings, holidays) => { holidays.push({ day: holidayDay, name: holidayName.trim() }); });
            setHolidayDay("");
            setHolidayName("");
          }}>날짜 추가</button>
        </div>
        {data.holidays.map((holiday) => (
          <div key={holiday.day} className="item">
            <span>{holiday.day} {holiday.name}</span>
            <button className="btn" type="button" onClick={() => patchSettings((_settings, holidays) => {
              const index = holidays.findIndex((item) => item.day === holiday.day);
              if (index >= 0) holidays.splice(index, 1);
            })}>빼기</button>
          </div>
        ))}
        <button className="btn primary mutate" disabled={!online} onClick={() => void save()}>설정 저장</button>
      </section>
      <section className="panel">
        <h2>연동과 실행 기록</h2>
        <p>봇 API 토큰: {data.integration.botTokenConfigured ? "설정됨" : "설정되지 않음"}</p>
        <p>스케줄 웹훅 토큰: {data.integration.schedulerTokenConfigured ? "설정됨" : "설정되지 않음"}</p>
        <p>무인 스케줄: {data.integration.unattendedScheduling ? "켜짐" : "꺼짐"}</p>
        <p className="hint">{data.integration.schedulingNote}</p>
        <p className="hint">{data.integration.backupNote}</p>
        <button className="btn mutate" disabled={!online} onClick={() => void runJobs()}>지금 실행</button>
        {data.jobs.map((job) => (
          <div key={job.job} className={job.warning ? "item late" : "item"}>
            <span>
              <span className="title">{job.label}</span>
              <span className="sub">성공 {formatWhen(job.lastSuccessAt)} · 다음 {formatWhen(job.nextDueAt)} · 재시도 {job.retryCount}{job.lastError ? ` · ${job.lastError}` : ""}</span>
            </span>
            {job.warning ? <span className="chip p-긴급">{job.warningText}</span> : null}
          </div>
        ))}
        <h2>최근 실행</h2>
        {data.runs.length === 0 ? <p className="state">실행 기록이 없습니다.</p> : data.runs.slice(0, 12).map((run) => (
          <div key={run.id} className="item">
            <span>{run.job} · {run.status} · {run.source}</span>
            <span className="sub">{formatWhen(run.startedAt)}{run.error ? ` · ${run.error}` : ""}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
