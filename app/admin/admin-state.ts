import { type MemberRow } from "@/app/admin/member-diff";
import { type Settings } from "@/app/admin/settings-type";

export type AdminState = {
  members: MemberRow[];
  invites: { id: string; email: string; role: string; acceptedAt: string | null }[];
  categories: { id: string; name: string; archived: boolean }[];
  settings: Settings;
  holidays: { day: string; name: string }[];
  jobs: { job: string; label: string; lastSuccessAt: string | null; lastError: string | null; retryCount: number; nextDueAt: string | null; warning: boolean; warningText: string }[];
  runs: { id: string; source: string; job: string; status: string; error: string | null; startedAt: string | null }[];
  integration: { botTokenConfigured: boolean; schedulerTokenConfigured: boolean; unattendedScheduling: boolean; schedulingNote: string; pushNote: string; backupNote: string };
};
