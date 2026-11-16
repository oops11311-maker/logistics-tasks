"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { JOBS, ROLES, jobLabel } from "@/lib/labels";
import { useApp } from "./shell";

type Member = { id: string; name: string; email: string; role: string; active: boolean };
type Invite = { id: string; email: string; hasIdentity: boolean; role: string; acceptedAt: string; revokedAt: string };
type Category = { id: string; name: string; active: boolean; sortOrder: number };
type Settings = {
  weekdaySummaryTime: string;
  weekdaySummaryEnabled: boolean;
  dueSoonEnabled: boolean;
  dueSoonDays: number;
  overdueEnabled: boolean;
  staleEnabled: boolean;
  staleBusinessDays: number;
  weeklyEnabled: boolean;
  weeklyDow: number;
  weeklyTime: string;
  recurrenceTime: string;
  recurrenceEnabled: boolean;
  businessDays: number[];
  excludeHolidays: boolean;
  holidays: string[];
  scopeCategoryIds: string[] | null;
  notifyDueSoon: boolean;
  notifyOverdue: boolean;
  notifyStale: boolean;
  notifyMentions: boolean;
  holidayNote: string;
  schedulingActive: boolean;
  schedule: { job: string; label: string; enabled: boolean; nextAt: string | null; lastDueSlot: string | null; holidayNote: string }[];
};
type Run = { id: string; job: string; slotKey: string; status: string; error: string; startedAt: string; finishedAt: string };

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function Admin() {
  const { me, online, toast } = useApp();
  const [tab, setTab] = useState("members");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [sub, setSub] = useState("");
  const [role, setRole] = useState("member");
  const [categoryName, setCategoryName] = useState("");
  const [holiday, setHoliday] = useState("");

  function load() {
    Promise.all([
      api<{ members: Member[]; invites: Invite[] }>("/api/members"),
      api<{ categories: Category[] }>("/api/categories"),
      api<{ settings: Settings }>("/api/admin/settings"),
      api<{ runs: Run[]; schedule: Settings["schedule"] }>("/api/admin/runs"),
    ]).then(([memberData, categoryData, settingData, runData]) => {
      setMembers(memberData.members);
      setInvites(memberData.invites);
      setCategories(categoryData.categories);
      setSettings(settingData.settings);
      setRuns(runData.runs);
      setError("");
    }).catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : "관리 정보를 불러오지 못했습니다."));
  }
  useEffect(load, []);
  if (me.member.role !== "admin") return <p className="error">관리자만 열 수 있습니다.</p>;
  if (error) return <div className="error"><p>{error}</p><button className="solid" onClick={load}>다시 시도</button></div>;
  if (!settings) return <p className="loading">불러오는 중</p>;

  async function saveSettings(patch: Record<string, unknown>) {
    if (!online) return toast("오프라인에서는 저장할 수 없습니다.", false);
    try {
      const result = await api<{ settings: Settings }>("/api/admin/settings", { method: "PUT", body: JSON.stringify(patch) });
      setSettings(result.settings);
      toast("설정을 저장했습니다.");
    } catch (reason) {
      toast(reason instanceof ApiError ? reason.message : "저장하지 못했습니다.", false);
    }
  }

  return (
    <div className="grid">
      <h1 style={{ margin: 0 }}>관리</h1>
      <div className="warn">예약 실행은 연결되어 있지 않습니다. 아래 ‘지금 실행’만 동작합니다. 봇 토큰은 {me.botTokenConfigured ? "서버에 설정됨" : "아직 없음"}, 예약 토큰은 {me.schedulerTokenConfigured ? "서버에 설정됨" : "아직 없음"}입니다. 값은 이 화면에 입력하지 않습니다.</div>
      <div className="tabs">
        {[["members", "구성원"], ["categories", "분류"], ["bot", "봇"], ["runs", "실행 기록"]].map(([id, label]) => (
          <button key={id} className="quiet" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === "members" ? (
        <section className="panel">
          <h2>초대</h2>
          <form className="grid" onSubmit={(event) => {
            event.preventDefault();
            api("/api/members/invite", { method: "POST", body: JSON.stringify({ email, sub, role }) }).then(() => {
              setEmail(""); setSub(""); toast("초대했습니다."); load();
            }).catch((reason: unknown) => toast(reason instanceof ApiError ? reason.message : "초대하지 못했습니다.", false));
          }}>
            <label className="field"><span>이메일</span><input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label className="field"><span>Cursor 식별자 (이메일이 없을 때만)</span><input value={sub} onChange={(event) => setSub(event.target.value)} autoComplete="off" /></label>
            <select aria-label="역할" value={role} onChange={(event) => setRole(event.target.value)}>
              {ROLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <button className="solid" disabled={!online}>초대</button>
          </form>
          {members.map((member) => (
            <div key={member.id} className="row comment">
              <div className="grow"><strong>{member.name}</strong><div className="meta">{member.email || "이메일 없음"} · {member.active ? "활성" : "비활성"}</div></div>
              <select aria-label={`${member.name} 역할`} value={member.role} disabled={!online} onChange={(event) => api(`/api/members/${member.id}`, { method: "PATCH", body: JSON.stringify({ role: event.target.value }) }).then(() => { toast("역할을 바꿨습니다."); load(); }).catch((reason: unknown) => toast(reason instanceof ApiError ? reason.message : "바꾸지 못했습니다.", false))}>
                {ROLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <button className="quiet" disabled={!online} onClick={() => api(`/api/members/${member.id}`, { method: "PATCH", body: JSON.stringify({ active: !member.active }) }).then(() => { toast(member.active ? "비활성화했습니다." : "다시 활성화했습니다."); load(); }).catch((reason: unknown) => toast(reason instanceof ApiError ? reason.message : "바꾸지 못했습니다.", false))}>{member.active ? "비활성화" : "활성화"}</button>
            </div>
          ))}
          <h3>초대 목록</h3>
          {invites.length === 0 ? <p className="empty">초대가 없습니다.</p> : invites.map((invite) => (
            <div key={invite.id} className="meta">{invite.email || (invite.hasIdentity ? "식별자 초대" : "초대")} · {invite.role} · {invite.acceptedAt ? "수락" : invite.revokedAt ? "취소" : "대기"}</div>
          ))}
        </section>
      ) : null}
      {tab === "categories" ? (
        <section className="panel">
          <form className="row" onSubmit={(event) => { event.preventDefault(); api("/api/categories", { method: "POST", body: JSON.stringify({ name: categoryName }) }).then(() => { setCategoryName(""); toast("분류를 추가했습니다."); load(); }).catch((reason: unknown) => toast(reason instanceof ApiError ? reason.message : "추가하지 못했습니다.", false)); }}>
            <input className="grow" aria-label="분류 이름" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
            <button className="solid" disabled={!online}>추가</button>
          </form>
          {categories.map((category) => (
            <div key={category.id} className="row comment">
              <input className="grow" defaultValue={category.name} aria-label={`${category.name} 이름`} onBlur={(event) => { if (event.target.value !== category.name) api(`/api/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ name: event.target.value }) }).then(() => toast("이름을 바꿨습니다.")).catch((reason: unknown) => toast(reason instanceof ApiError ? reason.message : "바꾸지 못했습니다.", false)); }} />
              <button className="quiet" disabled={!online} onClick={() => api(`/api/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ active: !category.active }) }).then(() => { toast("분류를 갱신했습니다."); load(); }).catch((reason: unknown) => toast(reason instanceof ApiError ? reason.message : "바꾸지 못했습니다.", false))}>{category.active ? "숨기기" : "다시 사용"}</button>
            </div>
          ))}
        </section>
      ) : null}
      {tab === "bot" ? (
        <section className="panel">
          <p>{settings.holidayNote}</p>
          <p className="meta">영업일 기본값은 월요일부터 금요일입니다. 휴일은 켜기 전까지 빼지 않습니다.</p>
          <label className="check"><input type="checkbox" checked={settings.excludeHolidays} onChange={(event) => void saveSettings({ excludeHolidays: event.target.checked })} /> 휴일 제외</label>
          <div className="row">
            <input aria-label="휴일" type="date" value={holiday} onChange={(event) => setHoliday(event.target.value)} />
            <button className="quiet" type="button" disabled={!online || !holiday} onClick={() => void saveSettings({ holidays: [...settings.holidays, holiday] })}>휴일 추가</button>
          </div>
          <div className="meta">{settings.holidays.join(", ") || "등록된 휴일 없음"}</div>
          <label className="field"><span>평일 요약 시각</span><input type="time" value={settings.weekdaySummaryTime} onChange={(event) => void saveSettings({ weekdaySummaryTime: event.target.value })} /></label>
          <label className="field"><span>마감 며칠 전 알림</span><input type="number" min={1} max={14} value={settings.dueSoonDays} onChange={(event) => void saveSettings({ dueSoonDays: Number(event.target.value) })} /></label>
          <label className="field"><span>진행 정체 영업일</span><input type="number" min={1} max={30} value={settings.staleBusinessDays} onChange={(event) => void saveSettings({ staleBusinessDays: Number(event.target.value) })} /></label>
          <label className="field"><span>주간 초안 요일</span>
            <select value={settings.weeklyDow} onChange={(event) => void saveSettings({ weeklyDow: Number(event.target.value) })}>
              {DAYS.map((label, index) => <option key={label} value={index}>{label}</option>)}
            </select>
          </label>
          <label className="field"><span>주간 초안 시각</span><input type="time" value={settings.weeklyTime} onChange={(event) => void saveSettings({ weeklyTime: event.target.value })} /></label>
          <label className="field"><span>반복 생성 시각</span><input type="time" value={settings.recurrenceTime} onChange={(event) => void saveSettings({ recurrenceTime: event.target.value })} /></label>
          <div className="chips">
            {DAYS.map((label, index) => (
              <button key={label} type="button" className="quiet" aria-pressed={settings.businessDays.includes(index)} onClick={() => {
                const next = settings.businessDays.includes(index) ? settings.businessDays.filter((day) => day !== index) : [...settings.businessDays, index];
                void saveSettings({ businessDays: next });
              }}>{label}</button>
            ))}
          </div>
          {([
            ["weekdaySummaryEnabled", "평일 요약"],
            ["dueSoonEnabled", "마감 전 알림"],
            ["overdueEnabled", "기한 지남 알림"],
            ["staleEnabled", "정체 확인"],
            ["weeklyEnabled", "주간 초안"],
            ["recurrenceEnabled", "반복 생성"],
            ["notifyDueSoon", "마감 전 수신함"],
            ["notifyOverdue", "지연 수신함"],
            ["notifyStale", "정체 수신함"],
            ["notifyMentions", "언급 수신함"],
          ] as const).map(([key, label]) => (
            <label key={key} className="check"><input type="checkbox" checked={Boolean(settings[key])} onChange={(event) => void saveSettings({ [key]: event.target.checked })} /> {label}</label>
          ))}
          <label className="field"><span>봇이 보는 분류 (비우면 전체)</span>
            <select multiple value={settings.scopeCategoryIds ?? []} onChange={(event) => {
              const values = [...event.target.selectedOptions].map((option) => option.value);
              void saveSettings({ scopeCategoryIds: values.length ? values : null });
            }}>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        </section>
      ) : null}
      {tab === "runs" ? (
        <section className="panel">
          <p className="warn">자동 실행은 꺼져 있습니다. 예정 시각이 지나도 서버가 스스로 실행하지 않습니다. 성공 기록이 없으면 아래 경고가 남습니다.</p>
          {settings.schedule.map((item) => (
            <div key={item.job} className="comment">
              <strong>{item.label}</strong>
              <div className="meta">
                <span>{item.enabled ? "사용" : "끔"}</span>
                <span>다음 예정 {item.nextAt ? new Date(item.nextAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "없음"}</span>
                <span>최근 슬롯 {item.lastDueSlot ?? "없음"}</span>
              </div>
              {!item.lastDueSlot || runs.some((run) => run.job === item.job && run.slotKey === item.lastDueSlot && run.status === "success") ? null : <div className="warn">예정 시각이 지났지만 성공 기록이 없습니다.</div>}
              <button className="solid" disabled={!online} onClick={() => api("/api/jobs/run", { method: "POST", body: JSON.stringify({ force: true, only: item.job }) }).then(() => { toast("실행했습니다."); load(); }).catch((reason: unknown) => toast(reason instanceof ApiError ? reason.message : "실행하지 못했습니다.", false))}>지금 실행</button>
            </div>
          ))}
          <h3>기록</h3>
          {runs.length === 0 ? <p className="empty">실행 기록이 없습니다.</p> : (
            <table className="list-table" style={{ display: "table" }}>
              <thead><tr><th>작업</th><th>슬롯</th><th>상태</th><th>오류</th></tr></thead>
              <tbody>
                {runs.map((run) => <tr key={run.id}><td>{jobLabel(run.job) || JOBS.find((item) => item.id === run.job)?.label || run.job}</td><td>{run.slotKey}</td><td>{run.status}</td><td>{run.error}</td></tr>)}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
    </div>
  );
}
