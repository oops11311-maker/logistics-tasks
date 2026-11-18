import type { FormEvent } from "react";
import { sendPassword } from "./shell-auth";

export async function submitShellPassword(input: {
  event: FormEvent;
  password: string;
  nextPassword: string;
  setFail: (value: string) => void;
  setPassword: (value: string) => void;
  setNextPassword: (value: string) => void;
  load: () => Promise<void>;
}) {
  input.event.preventDefault();
  input.setFail("");
  const result = await sendPassword(input.password, input.nextPassword);
  if (!result.ok) {
    input.setFail(result.message);
    return;
  }
  input.setPassword("");
  input.setNextPassword("");
  await input.load();
}
