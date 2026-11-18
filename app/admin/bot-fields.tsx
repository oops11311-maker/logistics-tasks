"use client";

import { BotScope } from "@/app/admin/bot-scope";
import { BotTimes } from "@/app/admin/bot-times";
import { type Settings } from "@/app/admin/types";

export function BotFields(props: {
  settings: Settings;
  categories: { id: string; name: string; archived: boolean }[];
  patch: (recipe: (settings: Settings, holidays: { day: string; name: string }[]) => void) => void;
}) {
  return (
    <>
      <BotTimes settings={props.settings} patch={props.patch} />
      <BotScope settings={props.settings} categories={props.categories} patch={props.patch} />
    </>
  );
}
