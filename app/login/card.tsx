"use client";

import type { FormEvent } from "react";

export function LoginCard(props: {
  phase: "login" | "password";
  username: string;
  password: string;
  nextPassword: string;
  fail: string;
  onUsername: (value: string) => void;
  onPassword: (value: string) => void;
  onNextPassword: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const login = props.phase === "login";
  return (
    <main className="login-wrap">
      <form className="login-card" onSubmit={(event) => void props.onSubmit(event)}>
        <h1>{login ? "로그인" : "비밀번호 변경"}</h1>
        <p className="hint">{login ? "사용자 이름과 비밀번호로 들어갑니다." : "처음 로그인하거나 비밀번호가 초기화된 뒤에는 새 비밀번호가 필요합니다."}</p>
        {login ? (
          <label className="stack">사용자 이름
            <input className="field" name="username" autoComplete="username" aria-label="사용자 이름" value={props.username} onChange={(event) => props.onUsername(event.target.value)} required />
          </label>
        ) : null}
        <label className="stack">{login ? "비밀번호" : "지금 비밀번호"}
          <input className="field" name="password" type="password" autoComplete="current-password" aria-label={login ? "비밀번호" : "지금 비밀번호"} value={props.password} onChange={(event) => props.onPassword(event.target.value)} required />
        </label>
        {login ? null : (
          <label className="stack">새 비밀번호
            <input className="field" name="new-password" type="password" autoComplete="new-password" aria-label="새 비밀번호" value={props.nextPassword} onChange={(event) => props.onNextPassword(event.target.value)} required />
          </label>
        )}
        {props.fail ? <p className="hint">{props.fail}</p> : null}
        <button className="btn primary" type="submit">{login ? "로그인" : "비밀번호 저장"}</button>
      </form>
    </main>
  );
}
