"use client";

import { memberDiffs, type MemberRow } from "@/app/admin/types";

export function MemberDialog(props: {
  meId: string;
  editing: MemberRow;
  draft: MemberRow;
  confirming: boolean;
  online: boolean;
  resetPassword: string;
  toast: (message: string) => void;
  onDraft: (member: MemberRow) => void;
  onConfirming: (value: boolean) => void;
  onResetPassword: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const { editing, draft } = props;
  return (
    <div className="scrim" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="member-edit-title">
        <h2 id="member-edit-title">{props.confirming ? "변경 확인" : `${editing.name} 편집`}</h2>
        {props.confirming ? (
          <>
            <ul className="diff">
              {memberDiffs(editing, draft).map((row) => (
                <li key={row.label}><b>{row.label}</b> {row.from} → {row.to}</li>
              ))}
            </ul>
            {editing.email !== draft.email ? <p className="hint">이메일은 연락용입니다. 로그인은 사용자 이름으로 합니다.</p> : null}
            {(editing.username ?? "") !== (draft.username ?? "") ? <p className="hint">사용자 이름을 바꿔도 지금 세션은 끊기지 않습니다.</p> : null}
            <div className="row">
              <button className="btn" type="button" onClick={() => props.onConfirming(false)}>뒤로</button>
              <button className="btn primary mutate" type="button" disabled={!props.online} onClick={props.onSave}>저장</button>
            </div>
          </>
        ) : (
          <form onSubmit={(event) => {
            event.preventDefault();
            if (memberDiffs(editing, draft).length === 0) return props.toast("바꿀 내용이 없습니다.");
            props.onConfirming(true);
          }}>
            <label className="stack">이름
              <input className="field" value={draft.name} onChange={(event) => props.onDraft({ ...draft, name: event.target.value })} required />
            </label>
            <label className="stack">사용자 이름
              <input className="field" aria-label="계정 사용자 이름" autoComplete="off" value={draft.username ?? ""} onChange={(event) => props.onDraft({ ...draft, username: event.target.value })} required />
            </label>
            <label className="stack">이메일
              <input className="field" type="text" inputMode="email" autoComplete="off" aria-label="계정 이메일" value={draft.email} onChange={(event) => props.onDraft({ ...draft, email: event.target.value })} />
            </label>
            <p className="hint">비워 둘 수 있습니다. 로그인은 사용자 이름이고, 이메일을 바꿔도 세션은 유지됩니다.</p>
            <label className="stack">역할
              <select className="control" value={draft.role} onChange={(event) => props.onDraft({ ...draft, role: event.target.value })}>
                <option value="admin">관리자</option>
                <option value="manager">매니저</option>
                <option value="member">멤버</option>
                <option value="viewer">뷰어</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={draft.active} disabled={editing.id === props.meId} onChange={(event) => props.onDraft({ ...draft, active: event.target.checked })} />
              사용 중
            </label>
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
          </form>
        )}
      </div>
    </div>
  );
}
