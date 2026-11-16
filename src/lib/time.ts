const OFFSET_MS = 9 * 60 * 60 * 1000;

export type SeoulParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
  date: string;
  time: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function seoulParts(now = new Date()): SeoulParts {
  const shifted = new Date(now.getTime() + OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  const weekday = shifted.getUTCDay();
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday,
    date: `${year}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${pad(minute)}`,
  };
}

export function seoulDate(now = new Date()): string {
  return seoulParts(now).date;
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

export function weekdayOf(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function weekRange(date: string): { start: string; end: string } {
  const weekday = weekdayOf(date);
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = addDays(date, mondayOffset);
  return { start, end: addDays(start, 6) };
}

export function monthRange(date: string): { start: string; end: string } {
  const [year, month] = date.split("-").map(Number);
  const start = `${year}-${pad(month)}-01`;
  const end = new Date(Date.UTC(year, month, 0));
  return {
    start,
    end: `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}`,
  };
}

export function dueInstant(dueDate: string, dueTime: string | null): Date {
  const clock = dueTime ? `${dueTime}:00.000` : "23:59:59.999";
  return new Date(`${dueDate}T${clock}+09:00`);
}

export function atSeoul(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000+09:00`);
}

export function isBusinessDay(
  date: string,
  businessDays: number[],
  holidays: string[],
  excludeHolidays: boolean,
): boolean {
  if (!businessDays.includes(weekdayOf(date))) return false;
  if (excludeHolidays && holidays.includes(date)) return false;
  return true;
}

/** Business days strictly after fromDate, up to and including toDate. */
export function businessDaysBetween(
  fromDate: string,
  toDate: string,
  businessDays: number[],
  holidays: string[],
  excludeHolidays: boolean,
): number {
  if (toDate <= fromDate) return 0;
  let count = 0;
  let cursor = fromDate;
  for (let step = 0; step < 400 && cursor < toDate; step += 1) {
    cursor = addDays(cursor, 1);
    if (isBusinessDay(cursor, businessDays, holidays, excludeHolidays)) count += 1;
  }
  return count;
}

export function seoulDayFromInstant(value: Date): string {
  return seoulParts(value).date;
}

export function formatSeoul(value: Date): string {
  const parts = seoulParts(value);
  return `${parts.date} ${parts.time}`;
}
