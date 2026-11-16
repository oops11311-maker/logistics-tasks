"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api, ApiError, roleLabel, type Category, type Person } from "./api";

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
  const [phase, setPhase] = useState<"loading" | "ready" | "forbidden" | "login" | "error">("loading");
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
      }>("/api/bootstrap");
      setMe(data.me);
      setCategories(data.categories);
      setMembers(data.members);
      setToday(data.today);
      setNotes(data.notifications.items);
      setUnread(data.notifications.unread);
      setPhase("ready");
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setPhase("forbidden");
      else if (error instanceof ApiError && error.status === 401) setPhase("login");
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
    ?? (pathname.startsWith("/tasks/") ? "업무" : pathname.startsWith("/admin") ? "관리" : "물류자동화 업무");

  if (phase === "loading") return <p className="state">불러오는 중…</p>;
  if (phase === "login") {
    return <main className="content"><h1>로그인이 필요합니다</h1><p>Cursor에 로그인한 뒤 다시 열어 주세요.</p></main>;
  }
  if (phase === "forbidden") {
    return (
      <main className="content">
        <h1>초대가 필요합니다</h1>
        <p>물류자동화팀 업무는 초대된 멤버만 볼 수 있습니다. 관리자에게 이메일 초대를 요청하세요.</p>
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
          <div className="meta">{me.name} · {roleLabel(me.role)}</div>
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
