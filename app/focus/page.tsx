"use client";

import { useEffect, useState } from "react";
import { FocusTable } from "@/app/focus/focus-table";
import { FocusDetail, type FocusPerson } from "@/app/focus/person";
import { api } from "@/components/api";
import { State } from "@/components/bits";
import { useApp } from "@/components/shell";

type Focus = {
  week: { start: string; end: string };
  note: string;
  people: FocusPerson[];
};

export default function FocusPage() {
  const { revision } = useApp();
  const [data, setData] = useState<Focus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError("");
    api<Focus>("/api/focus")
      .then((payload) => {
        setData(payload);
        setOpen((current) => current ?? payload.people[0]?.id ?? null);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [revision]);

  if (loading && !data) return <State kind="loading">불러오는 중…</State>;
  if (error) return <State kind="error" onRetry={load}>{error}</State>;
  if (!data) return <State kind="empty">집계가 없습니다.</State>;
  const person = data.people.find((item) => item.id === open) ?? data.people[0];

  return (
    <div className="list">
      <p className="hint">서울 {data.week.start}–{data.week.end}. {data.note}</p>
      <FocusTable people={data.people} openId={person?.id ?? null} onOpen={setOpen} />
      {person ? <FocusDetail person={person} /> : null}
    </div>
  );
}
