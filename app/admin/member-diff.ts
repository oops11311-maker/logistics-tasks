import { roleLabel } from "@/components/api";

export type MemberRow = { id: string; name: string; email: string; username: string | null; role: string; active: boolean };

export const DAYS = [["월", 1], ["화", 2], ["수", 3], ["목", 4], ["금", 5]] as const;

export function memberDiffs(before: MemberRow, after: MemberRow) {
  const rows: { label: string; from: string; to: string }[] = [];
  if (before.name !== after.name) rows.push({ label: "이름", from: before.name, to: after.name });
  if ((before.username ?? "") !== (after.username ?? "")) rows.push({ label: "사용자 이름", from: before.username || "—", to: after.username || "—" });
  if (before.email !== after.email) rows.push({ label: "이메일", from: before.email, to: after.email });
  if (before.role !== after.role) rows.push({ label: "역할", from: roleLabel(before.role), to: roleLabel(after.role) });
  if (before.active !== after.active) rows.push({ label: "상태", from: before.active ? "사용 중" : "비활성", to: after.active ? "사용 중" : "비활성" });
  return rows;
}
