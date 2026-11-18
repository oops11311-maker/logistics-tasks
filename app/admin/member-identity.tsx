"use client";

import { type MemberRow } from "@/app/admin/member-diff";

export function MemberIdentity(props: {
  meId: string;
  editing: MemberRow;
  draft: MemberRow;
  onDraft: (member: MemberRow) => void;
}) {
  const { editing, draft } = props;
  return (
    <>
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
    </>
  );
}
