"use client";

import type { FormEvent } from "react";
import { LoginCard } from "@/app/login/card";

export function ShellGate(props: {
  phase: "login" | "password";
  username: string;
  password: string;
  nextPassword: string;
  fail: string;
  onUsername: (value: string) => void;
  onPassword: (value: string) => void;
  onNextPassword: (value: string) => void;
  onLogin: (event: FormEvent) => void;
  onPasswordSubmit: (event: FormEvent) => void;
}) {
  return (
    <LoginCard
      phase={props.phase}
      username={props.username}
      password={props.password}
      nextPassword={props.nextPassword}
      fail={props.fail}
      onUsername={props.onUsername}
      onPassword={props.onPassword}
      onNextPassword={props.onNextPassword}
      onSubmit={(event) => void (props.phase === "login" ? props.onLogin(event) : props.onPasswordSubmit(event))}
    />
  );
}
