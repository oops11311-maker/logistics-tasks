"use client";

import { type Settings } from "@/app/admin/types";

export function BotScope(props: {
  settings: Settings;
  categories: { id: string; name: string; archived: boolean }[];
  patch: (recipe: (settings: Settings, holidays: { day: string; name: string }[]) => void) => void;
}) {
  const bot = props.settings.bot;
  return (
    <>
      <p className="hint">기본값: 평일 09:00 오늘·지연 요약, 마감 1영업일 전 알림, 지연 알림, 진행 중 3영업일 미갱신, 목요일 15:00 주간 초안.</p>
      <p className="hint">봇 범위. 아무 것도 고르지 않으면 전체 프로젝트입니다.</p>
      <div className="row">
        {props.categories.filter((category) => !category.archived).map((category) => (
          <label key={category.id} className="check">
            <input type="checkbox" checked={bot.categoryIds.includes(category.id)} onChange={(event) => props.patch((settings) => {
              settings.bot.categoryIds = event.target.checked
                ? [...settings.bot.categoryIds, category.id]
                : settings.bot.categoryIds.filter((id) => id !== category.id);
            })} />
            {category.name}
          </label>
        ))}
      </div>
    </>
  );
}
