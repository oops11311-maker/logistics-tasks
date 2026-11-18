"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { type Category, type Person } from "./api";

type Note = { id: string; href: string | null; title: string; body: string; readAt: string | null; createdAt: string | null };
type Me = { id: string; name: string; email: string; role: string };
type Phase = "loading" | "ready" | "password" | "login" | "error";
type InstallEvent = Event & { prompt: () => Promise<void> };

export function useShellStore() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [members, setMembers] = useState<Person[]>([]);
  const [today, setToday] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [online, setOnline] = useState(true);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [remote, setRemote] = useState(false);
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<Phase>("loading");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [fail, setFail] = useState("");
  const [openNotes, setOpenNotes] = useState(false);
  const [more, setMore] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  function toast(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2500);
  }
  return {
    pathname, me, setMe, categories, setCategories, members, setMembers, today, setToday, notes, setNotes, unread, setUnread,
    online, setOnline, revision, setRevision, dirty, setDirty, remote, setRemote, message, phase, setPhase,
    username, setUsername, password, setPassword, nextPassword, setNextPassword, fail, setFail,
    openNotes, setOpenNotes, more, setMore, install, setInstall, dirtyRef, toast,
  };
}
