"use client";

import { createContext, useContext } from "react";
import { type Category, type Person } from "./api";

type Note = { id: string; href: string | null; title: string; body: string; readAt: string | null; createdAt: string | null };
type Me = { id: string; name: string; email: string; role: string };

export type AppState = {
  me: Me;
  categories: Category[];
  members: Person[];
  today: string;
  unread: number;
  notes: Note[];
  online: boolean;
  revision: number;
  dirty: boolean;
  setDirty: (value: boolean) => void;
  toast: (message: string) => void;
  reload: () => void;
};

export const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const value = useContext(Ctx);
  if (!value) throw new Error("shell");
  return value;
}
