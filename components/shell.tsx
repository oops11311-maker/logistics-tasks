"use client";

import { type FormEvent } from "react";
import { pageTitle } from "./frame";
import { ShellGate } from "./shell-gate";
import { sendLogout } from "./shell-auth";
import { useShellEffects } from "./shell-effects";
import { loadShell, submitShellLogin, submitShellPassword } from "./shell-session";
import { ShellReady } from "./shell-ready";
import { useShellStore } from "./shell-store";

export { useApp } from "./shell-state";

export function Shell({ children }: { children: React.ReactNode }) {
  const state = useShellStore();
  const {
    pathname, me, setMe, setCategories, setMembers, setToday, setNotes, setUnread,
    setOnline, setRevision, setDirty, setRemote, phase, setPhase,
    username, setUsername, password, setPassword, nextPassword, setNextPassword, fail, setFail,
    setMore, setInstall, dirtyRef,
  } = state;

  function load() {
    return loadShell({ setMe, setCategories, setMembers, setToday, setNotes, setUnread, setPhase, setFail, showLogin });
  }

  useShellEffects({
    load, pathname, phase, dirtyRef, setOnline, setInstall, setDirty, setMore, setRemote, setRevision,
  });

  const title = pageTitle(pathname);

  if (phase === "loading") return <p className="state">불러오는 중…</p>;
  function showLogin() {
    setPhase("login");
  }

  function submitLogin(event: FormEvent) {
    return submitShellLogin({ event, username, password, setFail, setPassword, setPhase, load });
  }

  function submitPassword(event: FormEvent) {
    return submitShellPassword({ event, password, nextPassword, setFail, setPassword, setNextPassword, load });
  }

  async function logout() {
    await sendLogout();
    setMe(null);
    showLogin();
  }

  if (phase === "login" || phase === "password") {
    return (
      <ShellGate
        phase={phase}
        username={username}
        password={password}
        nextPassword={nextPassword}
        fail={fail}
        onUsername={setUsername}
        onPassword={setPassword}
        onNextPassword={setNextPassword}
        onLogin={submitLogin}
        onPasswordSubmit={submitPassword}
      />
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

  return <ShellReady state={state} title={title} logout={() => void logout()} load={load}>{children}</ShellReady>;
}
