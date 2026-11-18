"use client";

import { useState } from "react";
import { AccountHint } from "@/app/admin/account-hint";
import { AccountCreate } from "@/app/admin/account-create";
import { AccountEditor } from "@/app/admin/account-editor";
import { AccountTable } from "@/app/admin/account-table";
import { type AdminState, type MemberRow } from "@/app/admin/types";

export function AccountSection(props: {
  data: AdminState;
  meId: string;
  online: boolean;
  toast: (message: string) => void;
  reload: () => void;
}) {
  const [resetPassword, setResetPassword] = useState("");
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [draft, setDraft] = useState<MemberRow | null>(null);
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="panel">
      <AccountCreate online={props.online} toast={props.toast} reload={props.reload} />
      <AccountTable members={props.data.members} onEdit={(member) => { setEditing(member); setDraft({ ...member }); setConfirming(false); setResetPassword(""); }} />
      <AccountHint />
      {editing && draft ? (
        <AccountEditor
          meId={props.meId}
          editing={editing}
          draft={draft}
          confirming={confirming}
          online={props.online}
          resetPassword={resetPassword}
          toast={props.toast}
          reload={props.reload}
          onDraft={setDraft}
          onConfirming={setConfirming}
          onResetPassword={setResetPassword}
          onClose={() => { setEditing(null); setDraft(null); setConfirming(false); }}
        />
      ) : null}
    </section>
  );
}
