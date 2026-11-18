"use client";

export function MemberPassword(props: {
  online: boolean;
  resetPassword: string;
  onResetPassword: (value: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <label className="stack">비밀번호 다시 지정
        <input className="field" type="password" autoComplete="new-password" aria-label="임시 비밀번호" value={props.resetPassword} onChange={(event) => props.onResetPassword(event.target.value)} />
      </label>
      <div className="row">
        <button className="btn" type="button" disabled={!props.online || props.resetPassword.length < 10} onClick={props.onReset}>비밀번호 초기화</button>
      </div>
      <div className="row">
        <button className="btn" type="button" onClick={props.onClose}>취소</button>
        <button className="btn primary" type="submit">확인</button>
      </div>
    </>
  );
}
