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
  members: { id: string; name: string; email: string; username: string | null; role: string; active: boolean }[];
  invites: { id: string; email: string; role: string; acceptedAt: string | null }[];
  categories: { id: string; name: string; archived: boolean }[];
  settings: Settings;
  holidays: { day: string; name: string }[];
  jobs: { job: string; label: string; lastSuccessAt: string | null; lastError: string | null; retryCount: number; nextDueAt: string | null; warning: boolean; warningText: string }[];
  runs: { id: string; source: string; job: string; status: string; error: string | null; startedAt: string | null }[];
  integration: { botTokenConfigured: boolean; schedulerTokenConfigured: boolean; unattendedScheduling: boolean; schedulingNote: string; pushNote: string; backupNote: string };
};

const DAYS = [["월", 1], ["화", 2], ["수", 3], ["목", 4], ["금", 5]] as const;
type MemberRow = { id: string; name: string; email: string; username: string | null; role: string; active: boolean };

function memberDiffs(before: MemberRow, after: MemberRow) {
  const rows: { label: string; from: string; to: string }[] = [];
  if (before.name !== after.name) rows.push({ label: "이름", from: before.name, to: after.name });
  if (before.email !== after.email) rows.push({ label: "이메일", from: before.email, to: after.email });
  if (before.role !== after.role) rows.push({ label: "역할", from: roleLabel(before.role), to: roleLabel(after.role) });
  if (before.active !== after.active) rows.push({ label: "상태", from: before.active ? "사용 중" : "비활성", to: after.active ? "사용 중" : "비활성" });
  return rows;
}

export default function AdminPage() {
  const { me, online, toast, reload } = useApp();
  const [data, setData] = useState<StatePayload | null>(null);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [role, setRole] = useState("member");
  const [resetPassword, setResetPassword] = useState("");
  const [holidayDay, setHolidayDay] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [editing, setEditing] = useState<StatePayload["members"][number] | null>(null);
  const [draft, setDraft] = useState<StatePayload["members"][number] | null>(null);
  const [confirming, setConfirming] = useState(false);

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

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      await api("/api/admin/accounts", {
        method: "POST",
        mutate: true,
        body: JSON.stringify({ username, name: accountName, role, password: accountPassword }),
      });
      setUsername("");
      setAccountName("");
      setAccountPassword("");
      toast("계정을 만들었습니다. 처음 로그인하면 비밀번호를 바꿔야 합니다.");
      load();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "계정을 만들지 못했습니다.");
    }
  }

  async function resetAccount() {
    if (!editing) return;
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      await api(`/api/admin/accounts/${editing.id}/password`, {
        method: "POST",
        mutate: true,
        body: JSON.stringify({ password: resetPassword }),
      });
      setResetPassword("");
      toast("비밀번호를 다시 지정했습니다. 기존 로그인은 끊깁니다.");
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "비밀번호를 바꾸지 못했습니다.");
    }
  }

  async function saveMember() {
    if (!editing || !draft) return;
    if (!online) return toast("오프라인 상태에서는 편집할 수 없습니다.");
    const body: Record<string, unknown> = {};
    if (editing.name !== draft.name) body.name = draft.name;
    if (editing.email !== draft.email) body.email = draft.email;
    if (editing.role !== draft.role) body.role = draft.role;
    if (editing.active !== draft.active) body.active = draft.active;
    try {
      await api(`/api/admin/members/${editing.id}`, { method: "PATCH", mutate: true, body: JSON.stringify(body) });
      toast("저장했습니다.");
      setEditing(null);
      setDraft(null);
      setConfirming(false);
      load();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
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
        <h2>계정</h2>
        <form className="filters" onSubmit={(event) => void createAccount(event)}>
          <input className="field grow" required aria-label="사용자 이름" placeholder="사용자 이름" autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} />
          <input className="field grow" required aria-label="이름" placeholder="이름" value={accountName} onChange={(event) => setAccountName(event.target.value)} />
          <input className="field grow" required type="password" aria-label="처음 비밀번호" placeholder="처음 비밀번호" autoComplete="new-password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} />
          <select className="control" aria-label="역할" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="admin">관리자</option>
            <option value="manager">매니저</option>
            <option value="member">멤버</option>
            <option value="viewer">뷰어</option>
          </select>
          <button className="btn primary mutate" disabled={!online}>계정 만들기</button>
        </form>
        <p className="hint">관리자가 계정을 만들고 처음 비밀번호를 지정합니다. 이메일 인증은 없습니다. 그 비밀번호로 처음 들어오면 바로 바꿔야 합니다.</p>
        <div className="table-wrap">
          <table className="grid">
            <thead><tr><th>이름</th><th>사용자 이름</th><th>이메일</th><th>역할</th><th>상태</th><th /></tr></thead>
            <tbody>
              {data.members.map((member) => (
                <tr key={member.id}>
                  <td>{member.name}</td>
                  <td>{member.username || "—"}</td>
                  <td>{member.email || "—"}</td>
                  <td>{roleLabel(member.role)}</td>
                  <td>{member.active ? "사용 중" : "비활성"}</td>
                  <td><button className="btn" type="button" onClick={() => { setEditing(member); setDraft({ ...member }); setConfirming(false); setResetPassword(""); }}>편집</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">계정에 있는 항목은 이름, 이메일, 역할, 사용 여부입니다. 소속 팀 칸은 없습니다.</p>
        {editing && draft ? (
          <div className="scrim" role="presentation">
            <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="member-edit-title">
              <h2 id="member-edit-title">{confirming ? "변경 확인" : `${editing.name} 편집`}</h2>
              {confirming ? (
                <>
                  <ul className="diff">
                    {memberDiffs(editing, draft).map((row) => (
                      <li key={row.label}><b>{row.label}</b> {row.from} → {row.to}</li>
                    ))}
                  </ul>
                  {editing.email !== draft.email ? <p className="hint">이메일은 연락용입니다. 로그인은 사용자 이름으로 합니다.</p> : null}
                  <div className="row">
                    <button className="btn" type="button" onClick={() => setConfirming(false)}>뒤로</button>
                    <button className="btn primary mutate" type="button" disabled={!online} onClick={() => void saveMember()}>저장</button>
                  </div>
                </>
              ) : (
                <form onSubmit={(event) => {
                  event.preventDefault();
                  if (memberDiffs(editing, draft).length === 0) return toast("바꿀 내용이 없습니다.");
                  setConfirming(true);
                }}>
                  <label className="stack">이름
                    <input className="field" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
                  </label>
                  <label className="stack">사용자 이름
                    <input className="field" value={draft.username ?? ""} disabled />
                  </label>
                  <label className="stack">이메일
                    <input className="field" type="email" value={draft.email} disabled={editing.id === me.id} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
                  </label>
                  {editing.id === me.id ? <p className="hint">본인 이메일은 바꿀 수 없습니다.</p> : null}
                  <label className="stack">역할
                    <select className="control" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })}>
                      <option value="admin">관리자</option>
                      <option value="manager">매니저</option>
                      <option value="member">멤버</option>
                      <option value="viewer">뷰어</option>
                    </select>
                  </label>
                  <label className="check">
                    <input type="checkbox" checked={draft.active} disabled={editing.id === me.id} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
                    사용 중
                  </label>
                  <label className="stack">비밀번호 다시 지정
                    <input className="field" type="password" autoComplete="new-password" aria-label="임시 비밀번호" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
                  </label>
                  <div className="row">
                    <button className="btn" type="button" disabled={!online || resetPassword.length < 10} onClick={() => void resetAccount()}>비밀번호 초기화</button>
                  </div>
                  <div className="row">
                    <button className="btn" type="button" onClick={() => { setEditing(null); setDraft(null); setConfirming(false); }}>취소</button>
                    <button className="btn primary" type="submit">확인</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : null}
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
