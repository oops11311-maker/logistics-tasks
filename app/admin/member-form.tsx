"use client";

import { memberDiffs, type MemberRow } from "@/app/admin/member-diff";
import { MemberIdentity } from "@/app/admin/member-identity";
import { MemberPassword } from "@/app/admin/member-password";

export function MemberForm(props: {
  meId: string;
  editing: MemberRow;
  draft: MemberRow;
  online: boolean;
  resetPassword: string;
  toast: (message: string) => void;
  onDraft: (member: MemberRow) => void;
  onConfirming: (value: boolean) => void;
  onResetPassword: (value: string) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const { editing, draft } = props;
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (memberDiffs(editing, draft).length === 0) return props.toast("바꿀 내용이 없습니다.");
      props.onConfirming(true);
    }}>
      <MemberIdentity meId={props.meId} editing={editing} draft={draft} onDraft={props.onDraft} />
      <MemberPassword
        online={props.online}
        resetPassword={props.resetPassword}
        onResetPassword={props.onResetPassword}
        onReset={props.onReset}
        onClose={props.onClose}
      />
    </form>
  );
}
