"use client";

import { useState } from "react";
import { AccountCreate } from "@/app/admin/account-create";
import { MemberDialog } from "@/app/admin/member-dialog";
import { type AdminState, type MemberRow } from "@/app/admin/types";
import { api } from "@/components/api";

import { AccountTable } from "@/app/admin/account-table";
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

  async function resetAccount() {
    if (!editing) return;
    if (!props.online) return props.toast("오프라인 상태에서는 편집할 수 없습니다.");
    try {
      await api(`/api/admin/accounts/${editing.id}/password`, {
        method: "POST",
        mutate: true,
        body: JSON.stringify({ password: resetPassword }),
      });
      setResetPassword("");
      props.toast("비밀번호를 다시 지정했습니다. 기존 로그인은 끊깁니다.");
    } catch (reason) {
      props.toast(reason instanceof Error ? reason.message : "비밀번호를 바꾸지 못했습니다.");
    }
  }

  async function saveMember() {
    if (!editing || !draft) return;
    if (!props.online) return props.toast("오프라인 상태에서는 편집할 수 없습니다.");
    const body: Record<string, unknown> = {};
    if (editing.name !== draft.name) body.name = draft.name;
    if ((editing.username ?? "") !== (draft.username ?? "")) body.username = draft.username ?? "";
    if (editing.email !== draft.email) body.email = draft.email;
    if (editing.role !== draft.role) body.role = draft.role;
    if (editing.active !== draft.active) body.active = draft.active;
    try {
      await api(`/api/admin/members/${editing.id}`, { method: "PATCH", mutate: true, body: JSON.stringify(body) });
      props.toast("저장했습니다.");
      setEditing(null);
      setDraft(null);
      setConfirming(false);
      props.reload();
    } catch (reason) {
      props.toast(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
    }
  }

  return (
    <section className="panel">
      <AccountCreate online={props.online} toast={props.toast} reload={props.reload} />
      <AccountTable members={props.data.members} onEdit={(member) => { setEditing(member); setDraft({ ...member }); setConfirming(false); setResetPassword(""); }} />
      <p className="hint">계정에 있는 항목은 이름, 사용자 이름, 이메일, 역할, 사용 여부입니다. 소속 팀 칸은 없습니다. 사용자 이름이나 이메일을 바꿔도 이미 로그인된 세션은 유지되고, 다음 로그인은 사용자 이름으로 합니다. 이메일은 연락용이며 인증 메일은 보내지 않습니다. 비울 수 있습니다.</p>
      {editing && draft ? (
        <MemberDialog
          meId={props.meId}
          editing={editing}
          draft={draft}
          confirming={confirming}
          online={props.online}
          resetPassword={resetPassword}
          toast={props.toast}
          onDraft={setDraft}
          onConfirming={setConfirming}
          onResetPassword={setResetPassword}
          onClose={() => { setEditing(null); setDraft(null); setConfirming(false); }}
          onSave={() => void saveMember()}
          onReset={() => void resetAccount()}
        />
      ) : null}
    </section>
  );
}
