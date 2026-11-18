export type Settings = {
  revision: number;
  excludeHolidays: boolean;
  bot: {
    summaryTime: string;
    summaryWeekdays: number[];
    dueSoonBusinessDays: number;
    staleBusinessDays: number;
    overdueAlerts: boolean;
    weeklyWeekday: number;
    weeklyTime: string;
    categoryIds: string[];
  };
  notifications: { inApp: boolean; dueSoon: boolean; overdue: boolean; stale: boolean; mentions: boolean };
};
