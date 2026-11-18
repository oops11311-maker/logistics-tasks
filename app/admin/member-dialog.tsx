"use client";

import { memberDiffs, type MemberRow } from "@/app/admin/member-diff";
import { MemberForm } from "@/app/admin/member-form";

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
        ) : <MemberForm {...props} />}
      </div>
    </div>
  );
}
