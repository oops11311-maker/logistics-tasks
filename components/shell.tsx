"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, roleLabel, setCsrf, type Category, type Person } from "./api";

type Note = { id: string; href: string | null; title: string; body: string; readAt: string | null; createdAt: string | null };
type Me = { id: string; name: string; email: string; role: string };

type AppState = {
  me: Me;
  categories: Category[];
  members: Person[];
  today: string;
  unread: number;
  notes: Note[];
  online: boolean;
  revision: number;
  dirty: boolean;
  setDirty: (value: boolean) => void;
  toast: (message: string) => void;
  reload: () => void;
};

const Ctx = createContext<AppState | null>(null);
export function useApp(): AppState {
  const value = useContext(Ctx);
  if (!value) throw new Error("shell");
  return value;
}

const LINKS = [
  ["/", "대시보드"],
  ["/my", "내 업무"],
  ["/team", "팀 업무"],
  ["/projects", "프로젝트"],
  ["/reports", "보고서"],
  ["/focus", "효율"],
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Person[]>([]);
  const [today, setToday] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [online, setOnline] = useState(true);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [remote, setRemote] = useState(false);
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<"loading" | "ready" | "password" | "login" | "error">("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [fail, setFail] = useState("");
  const [openNotes, setOpenNotes] = useState(false);
  const [more, setMore] = useState(false);
  const [install, setInstall] = useState<BeforeInstallPromptEvent | null>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  function toast(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2500);
  }

  async function load() {
    try {
      const data = await api<{
        me: Me;
        categories: Category[];
        members: Person[];
        today: string;
        notifications: { unread: number; items: Note[] };
        csrfToken?: string;
      }>("/api/bootstrap");
      if (data.csrfToken) setCsrf(data.csrfToken);
      setMe(data.me);
      setCategories(data.categories);
      setMembers(data.members);
      setToday(data.today);
      setNotes(data.notifications.items);
      setUnread(data.notifications.unread);
      setPhase("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 403 && error.payload?.error === "password_change_required") {
        if (typeof error.payload.csrfToken === "string") setCsrf(error.payload.csrfToken);
        setPhase("password");
      } else if (error instanceof ApiError && error.status === 401) setPhase("login");
      else {
        setFail(error instanceof Error ? error.message : "불러오지 못했습니다.");
        setPhase("error");
      }
    }
  }

  useEffect(() => {
    void load();
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstall(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  useEffect(() => {
    setDirty(false);
    setMore(false);
  }, [pathname]);

  useEffect(() => {
    if (phase !== "ready") return;
    let cursor = "";
    let stop = false;
    const tick = async () => {
      if (stop || document.hidden) return;
      try {
        const data = await api<{ cursor: string | null }>("/api/sync");
        const next = data.cursor ?? "";
        if (cursor && next !== cursor) {
          if (dirtyRef.current) setRemote(true);
          else setRevision((value) => value + 1);
        }
        cursor = next;
      } catch {
        /* 다음 주기에 다시 시도한다. */
      }
    };
    const timer = window.setInterval(() => void tick(), 8000);
    void tick();
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [phase]);

  const title = LINKS.find((item) => item[0] === pathname)?.[1]
    ?? (pathname.startsWith("/tasks/") ? "업무" : pathname.startsWith("/admin") ? "관리" : pathname.startsWith("/focus") ? "효율" : "물류자동화 업무");

  if (phase === "loading") return <p className="state">불러오는 중…</p>;
  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    setFail("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as { message?: string; csrfToken?: string; mustChangePassword?: boolean };
      if (!response.ok) {
        setFail(data.message ?? "로그인하지 못했습니다.");
        return;
      }
      if (data.csrfToken) setCsrf(data.csrfToken);
      setPassword("");
      if (data.mustChangePassword) {
        setPhase("password");
        return;
      }
      await load();
    } catch {
      setFail("네트워크에 연결하지 못했습니다.");
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setFail("");
    try {
      const data = await api<{ csrfToken?: string }>("/api/auth/password", {
        method: "POST",
        mutate: true,
        body: JSON.stringify({ currentPassword: password, newPassword: nextPassword }),
      });
      if (data.csrfToken) setCsrf(data.csrfToken);
      setPassword("");
      setNextPassword("");
      await load();
    } catch (error) {
      setFail(error instanceof Error ? error.message : "비밀번호를 바꾸지 못했습니다.");
    }
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST", mutate: true, body: "{}" });
    } catch {
      /* 쿠키가 이미 없어도 로그인 화면으로 돌아간다. */
    }
    setCsrf("");
    setMe(null);
    setPhase("login");
  }

  if (phase === "login" || phase === "password") {
    return (
      <main className="login-wrap">
        <form className="login-card" onSubmit={(event) => void (phase === "login" ? submitLogin(event) : submitPassword(event))}>
          <h1>{phase === "login" ? "로그인" : "비밀번호 변경"}</h1>
          <p className="hint">{phase === "login" ? "사용자 이름과 비밀번호로 들어갑니다." : "처음 로그인하거나 비밀번호가 초기화된 뒤에는 새 비밀번호가 필요합니다."}</p>
          {phase === "login" ? (
            <label className="stack">사용자 이름
              <input className="field" name="username" autoComplete="username" aria-label="사용자 이름" value={username} onChange={(event) => setUsername(event.target.value)} required />
            </label>
          ) : null}
          <label className="stack">{phase === "login" ? "비밀번호" : "지금 비밀번호"}
            <input className="field" name="password" type="password" autoComplete={phase === "login" ? "current-password" : "current-password"} aria-label={phase === "login" ? "비밀번호" : "지금 비밀번호"} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {phase === "password" ? (
            <label className="stack">새 비밀번호
              <input className="field" name="new-password" type="password" autoComplete="new-password" aria-label="새 비밀번호" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} required />
            </label>
          ) : null}
          {fail ? <p className="hint">{fail}</p> : null}
          <button className="btn primary" type="submit">{phase === "login" ? "로그인" : "비밀번호 저장"}</button>
        </form>
      </main>
    );
  }
  if (phase === "error" || !me) {
    return (
      <main className="content">
        <h1>불러오지 못했습니다</h1>
        <p>{fail}</p>
        <button className="btn" onClick={() => void load()}>다시 시도</button>
      </main>
    );
  }

  const value: AppState = {
    me, categories, members, today, unread, notes, online, revision, dirty, setDirty, toast,
    reload: () => setRevision((item) => item + 1),
  };

  return (
    <Ctx.Provider value={value}>
      <div className={online ? "app" : "app is-offline"}>
        <aside className="side">
          <div className="brand">
            <img src="/icons/icon-192.png" alt="" />
            <div><strong>물류자동화 업무</strong><span>서울 시간 · {today}</span></div>
          </div>
          <nav>
            {LINKS.map(([href, label]) => (
              <Link key={href} href={href} className={pathname === href ? "active" : ""}>{label}</Link>
            ))}
            {me.role === "admin" ? <Link href="/admin" className={pathname === "/admin" ? "active" : ""}>관리</Link> : null}
          </nav>
          <div className="meta">
            <div>{me.name} · {roleLabel(me.role)}</div>
            <button className="btn" type="button" onClick={() => void logout()}>로그아웃</button>
          </div>
        </aside>
        <div className="main">
          <header className="top">
            <div>
              <h1>{title}</h1>
              <div className="who">{me.name} · {roleLabel(me.role)} · 서울 {today}</div>
            </div>
            <div className="row">
              {install ? (
                <button className="btn" onClick={() => void install.prompt()}>앱 설치</button>
              ) : (
                <span className="hint">홈 화면에 추가할 수 있습니다</span>
              )}
              <button className="btn" onClick={() => setOpenNotes((open) => !open)}>알림 {unread}</button>
            </div>
          </header>
          {!online ? <div className="banner bad">오프라인 상태입니다. 연결되면 다시 편집할 수 있습니다.</div> : null}
          {remote ? (
            <div className="banner">
              다른 변경이 있습니다.
              <button className="btn" onClick={() => { setRemote(false); setDirty(false); setRevision((item) => item + 1); }}>새로고침</button>
            </div>
          ) : null}
          {openNotes ? (
            <div className="panel note-pop">
              <h2>알림</h2>
              {notes.length === 0 ? <p className="state">알림이 없습니다.</p> : notes.map((note) => (
                <Link key={note.id} href={note.href ?? "/"} className="item" onClick={() => void api("/api/notifications/read", { method: "POST", mutate: true, body: JSON.stringify({ ids: [note.id] }) })}>
                  <span><span className="title">{note.title}</span><span className="sub">{note.body}</span></span>
                </Link>
              ))}
              <button className="btn mutate" disabled={!online} onClick={() => void api("/api/notifications/read", { method: "POST", mutate: true, body: JSON.stringify({ all: true }) }).then(load)}>모두 읽음</button>
            </div>
          ) : null}
          <div className="content">{children}</div>
        </div>
        <nav className="tabbar">
          <Link href="/" className={pathname === "/" ? "active" : ""}>대시보드</Link>
          <Link href="/my" className={pathname === "/my" ? "active" : ""}>내 업무</Link>
          <Link href="/team" className={pathname.startsWith("/team") ? "active" : ""}>팀</Link>
          <Link href="/reports" className={pathname === "/reports" ? "active" : ""}>보고서</Link>
          <button type="button" onClick={() => setMore((open) => !open)}>더보기</button>
        </nav>
        {more ? (
          <div className="more">
            <Link href="/projects">프로젝트</Link>
            <Link href="/focus">효율</Link>
            {me.role === "admin" ? <Link href="/admin">관리</Link> : null}
            <button className="navish" type="button" onClick={() => setOpenNotes(true)}>알림 {unread}</button>
            {install ? <button className="navish" type="button" onClick={() => void install.prompt()}>앱 설치</button> : <p className="hint">브라우저 메뉴에서 홈 화면에 추가하세요.</p>}
          </div>
        ) : null}
        {message ? <div className="toast">{message}</div> : null}
      </div>
    </Ctx.Provider>
  );
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };
