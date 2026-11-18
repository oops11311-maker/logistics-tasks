"use client";

import { resetAccountPassword, saveMemberEdits } from "@/app/admin/account-actions";
import { MemberDialog } from "@/app/admin/member-dialog";
import { type MemberRow } from "@/app/admin/types";

export function AccountEditor(props: {
  meId: string;
  editing: MemberRow;
  draft: MemberRow;
  confirming: boolean;
  online: boolean;
  resetPassword: string;
  toast: (message: string) => void;
  reload: () => void;
  onDraft: (member: MemberRow) => void;
  onConfirming: (value: boolean) => void;
  onResetPassword: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <MemberDialog
      meId={props.meId}
      editing={props.editing}
      draft={props.draft}
      confirming={props.confirming}
      online={props.online}
      resetPassword={props.resetPassword}
      toast={props.toast}
      onDraft={props.onDraft}
      onConfirming={props.onConfirming}
      onResetPassword={props.onResetPassword}
      onClose={props.onClose}
      onSave={() => void saveMemberEdits({
        editing: props.editing, draft: props.draft, online: props.online, toast: props.toast, reload: props.reload, done: props.onClose,
      })}
      onReset={() => void resetAccountPassword({
        editing: props.editing, online: props.online, password: props.resetPassword, toast: props.toast, clear: () => props.onResetPassword(""),
      })}
    />
  );
}
