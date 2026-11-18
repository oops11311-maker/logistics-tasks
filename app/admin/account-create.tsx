"use client";

import { useState } from "react";
import { createAccount } from "@/app/admin/account-create-action";

export function AccountCreate(props: {
  online: boolean;
  toast: (message: string) => void;
  reload: () => void;
}) {
  const [username, setUsername] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [role, setRole] = useState("member");

  return (
    <>
      <h2>계정</h2>
      <form className="filters" onSubmit={(event) => void createAccount({
        event, online: props.online, toast: props.toast, username, name: accountName, role, password: accountPassword,
        clear: () => { setUsername(""); setAccountName(""); setAccountPassword(""); }, reload: props.reload,
      })}>
        <input className="field grow" required aria-label="사용자 이름" placeholder="사용자 이름" autoComplete="off" value={username} onChange={(event) => setUsername(event.target.value)} />
        <input className="field grow" required aria-label="이름" placeholder="이름" value={accountName} onChange={(event) => setAccountName(event.target.value)} />
        <input className="field grow" required type="password" aria-label="처음 비밀번호" placeholder="처음 비밀번호" autoComplete="new-password" value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} />
        <select className="control" aria-label="역할" value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="admin">관리자</option>
          <option value="manager">매니저</option>
          <option value="member">멤버</option>
          <option value="viewer">뷰어</option>
        </select>
        <button className="btn primary mutate" disabled={!props.online}>계정 만들기</button>
      </form>
      <p className="hint">관리자가 계정을 만들고 처음 비밀번호를 지정합니다. 이메일 인증은 없습니다. 그 비밀번호로 처음 들어오면 바로 바꿔야 합니다.</p>
    </>
  );
}
