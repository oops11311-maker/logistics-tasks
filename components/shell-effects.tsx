"use client";

import { useEffect, type MutableRefObject } from "react";
import { useShellSync } from "./shell-sync";

type InstallEvent = Event & { prompt: () => Promise<void> };

export function useShellEffects(input: {
  load: () => Promise<void>;
  pathname: string;
  phase: string;
  dirtyRef: MutableRefObject<boolean>;
  setOnline: (value: boolean) => void;
  setInstall: (value: InstallEvent | null) => void;
  setDirty: (value: boolean) => void;
  setMore: (value: boolean) => void;
  setRemote: (value: boolean) => void;
  setRevision: (value: (item: number) => number) => void;
}) {
  useEffect(() => {
    void input.load();
    const update = () => input.setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const onInstall = (event: Event) => {
      event.preventDefault();
      input.setInstall(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("beforeinstallprompt", onInstall);
    };
  }, []);

  useEffect(() => {
    input.setDirty(false);
    input.setMore(false);
  }, [input.pathname]);

  useShellSync(input);
}
