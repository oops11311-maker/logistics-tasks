import type { FormEvent } from "react";
import type { Category, Person } from "./api";
import { sendLogin } from "./shell-auth";
export { submitShellPassword } from "./shell-password";
import { bootSession, type Boot } from "./shell-boot";

type Note = { id: string; href: string | null; title: string; body: string; readAt: string | null; createdAt: string | null };
type Me = { id: string; name: string; email: string; role: string };
type Phase = "loading" | "ready" | "password" | "login" | "error";

export async function loadShell(input: {
  setMe: (value: Me | null) => void;
  setCategories: (value: Category[]) => void;
  setMembers: (value: Person[]) => void;
  setToday: (value: string) => void;
  setNotes: (value: Note[]) => void;
  setUnread: (value: number) => void;
  setPhase: (value: Phase) => void;
  setFail: (value: string) => void;
  showLogin: () => void;
}) {
  const result = await bootSession();
  applyBoot(result, input);
}

function applyBoot(result: Boot, input: Parameters<typeof loadShell>[0]) {
  if (result.phase === "ready") {
    input.setMe(result.me);
    input.setCategories(result.categories);
    input.setMembers(result.members);
    input.setToday(result.today);
    input.setNotes(result.notes);
    input.setUnread(result.unread);
    input.setPhase("ready");
    return;
  }
  if (result.phase === "password") {
    input.setPhase("password");
    return;
  }
  if (result.phase === "login") {
    input.showLogin();
    return;
  }
  input.setFail(result.message);
  input.setPhase("error");
}

export async function submitShellLogin(input: {
  event: FormEvent;
  username: string;
  password: string;
  setFail: (value: string) => void;
  setPassword: (value: string) => void;
  setPhase: (value: Phase) => void;
  load: () => Promise<void>;
}) {
  input.event.preventDefault();
  input.setFail("");
  const result = await sendLogin(input.username, input.password);
  if (!result.ok) {
    input.setFail(result.message);
    return;
  }
  input.setPassword("");
  if (result.mustChangePassword) {
    input.setPhase("password");
    return;
  }
  await input.load();
}

