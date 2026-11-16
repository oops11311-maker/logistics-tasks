"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError, type Me } from "@/lib/api";

type Toast = { text: string; ok: boolean };
type Ctx = {
  me: Me;
  online: boolean;
  toast: (text: string, ok?: boolean) => void;
  refresh: () => Promise<void>;
};

const AppContext = createContext<Ctx | null>(null);
export function useApp(): Ctx {
  const value = useContext(AppContext);
  if (!value) throw new Error("shell");
  return value;
}

const LINKS = [
  { href: "/", label: "현황" },
  { href: "/mine", label: "내 작업" },
  { href: "/team", label: "팀 작업" },
  { href: "/projects", label: "프로젝트" },
  { href: "/reports", label: "보고서" },
  { href: "/inbox", label: "알림" },
  { href: "/admin", label: "관리" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState<Toast | null>(null);
  const [install, setInstall] = useState<BeforeInstallPrompt | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hideHint, setHideHint] = useState(false);

  async function refresh() {
    const next = await api<Me>("/api/me");
    setMe(next);
    setError(null);
  }

  useEffect(() => {
    let stop = false;
    refresh().catch((reason: unknown) => {
      if (!stop) setError(reason instanceof ApiError ? reason : new ApiError("불러오지 못했습니다.", 0, "error"));
    });
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstall(event as BeforeInstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    setIosHint(ios && !standalone);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh().catch(() => undefined);
    }, 20000);
    return () => {
      stop = true;
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.clearInterval(timer);
    };
  }, []);

  const value = useMemo<Ctx | null>(() => {
    if (!me) return null;
    return {
      me,
      online,
      toast: (text, ok = true) => {
        setMessage({ text, ok });
        window.setTimeout(() => setMessage(null), 2800);
      },
      refresh,
    };
  }, [me, online]);

  const nav = LINKS.filter((item) => item.href !== "/admin" || me?.member.role === "admin");
  const bottom = [
    { href: "/", label: "현황" },
    { href: "/mine", label: "내 작업" },
    { href: "/team", label: "팀" },
    { href: "/reports", label: "보고" },
    { href: "/more", label: "더보기" },
  ];

  return (
    <div className="app">
      <nav className="side">
        <div className="brand">
          <strong>물류자동화팀</strong>
          <span>작업 추적</span>
        </div>
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div>
        <header className="topbar">
          <div className="brand">
            <strong>물류자동화팀</strong>
            <span>{me ? me.member.name : "작업 추적"}</span>
          </div>
          <div className="top-actions">
            <Link className="ghost bell" href="/inbox">
              알림
              {me && me.unreadNotifications > 0 ? <em className="badge">{me.unreadNotifications}</em> : null}
            </Link>
          </div>
        </header>
        <main className="main">
          {!online ? <div className="banner">오프라인입니다. 연결되기 전에는 저장할 수 없습니다.</div> : null}
          {me?.simulated ? (
            <div className="sim">로컬 미리보기입니다. 로그인한 사람이 아니라 시뮬레이션된 뷰어입니다. 데이터는 이 브라우저 저장소가 아니라 서버 데이터베이스에 있습니다.</div>
          ) : null}
          {!hideHint && install ? (
            <div className="note">
              홈 화면에 설치하면 앱처럼 열 수 있습니다.
              <button className="solid" style={{ marginLeft: 8 }} onClick={() => install.prompt()}>설치</button>
              <button className="quiet" style={{ marginLeft: 8 }} onClick={() => setHideHint(true)}>닫기</button>
            </div>
          ) : null}
          {!hideHint && iosHint ? (
            <div className="note">
              iPhone에서는 Safari 공유 버튼을 누른 뒤 “홈 화면에 추가”를 선택하세요.
              <button className="quiet" style={{ marginLeft: 8 }} onClick={() => setHideHint(true)}>닫기</button>
            </div>
          ) : null}
          {!me && !error ? <p className="loading">불러오는 중</p> : null}
          {error?.code === "not_member" || error?.code === "inactive" ? (
            <section className="panel">
              <h2>팀 작업에 들어갈 수 없습니다</h2>
              <p>{error.message}</p>
              <p>Cursor에 로그인한 계정으로 열어야 합니다. 관리자가 이메일로 초대한 뒤에만 작업이 보입니다. 이 화면의 새로고침은 데이터를 바꾸지 않습니다.</p>
              <button className="solid" onClick={() => refresh().catch((reason: unknown) => setError(reason instanceof ApiError ? reason : error))}>다시 확인</button>
            </section>
          ) : null}
          {error && error.code !== "not_member" && error.code !== "inactive" && !me ? (
            <section className="error">
              <p>{error.status === 401 ? "로그인이 필요합니다. 공개 주소로는 팀 작업을 열 수 없습니다." : error.message}</p>
              <button className="solid" onClick={() => refresh().catch(() => undefined)}>다시 시도</button>
            </section>
          ) : null}
          {value ? <AppContext.Provider value={value}>{children}</AppContext.Provider> : null}
          {message ? <div className={message.ok ? "toast" : "toast bad"}>{message.text}</div> : null}
        </main>
        <nav className="bottom">
          {bottom.map((item) => (
            <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

type BeforeInstallPrompt = Event & { prompt: () => Promise<void> };
