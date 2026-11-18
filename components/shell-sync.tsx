"use client";

import { useEffect, type MutableRefObject } from "react";
import { api } from "./api";

export function useShellSync(input: {
  phase: string;
  dirtyRef: MutableRefObject<boolean>;
  setRemote: (value: boolean) => void;
  setRevision: (value: (item: number) => number) => void;
}) {
  useEffect(() => {
    if (input.phase !== "ready") return;
    let cursor = "";
    let stop = false;
    const tick = async () => {
      if (stop || document.hidden) return;
      try {
        const data = await api<{ cursor: string | null }>("/api/sync");
        const next = data.cursor ?? "";
        if (cursor && next !== cursor) {
          if (input.dirtyRef.current) input.setRemote(true);
          else input.setRevision((value) => value + 1);
        }
        cursor = next;
      } catch {
        /* 다음 주기에 다시 시도한다. */
      }
    };
    const timer = window.setInterval(() => void tick(), 8000);
    void tick();
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [input.phase]);
}
