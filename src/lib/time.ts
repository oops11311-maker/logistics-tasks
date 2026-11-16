export const SEOUL = "Asia/Seoul";

export function seoulDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function seoulClock(now = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SEOUL,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return { hour: hour === 24 ? 0 : hour, minute };
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function weekdayOf(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function addMonths(dateStr: string, months: number, dayOfMonth: number): string {
  const [year, month] = dateStr.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = index % 12;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
  const day = Math.min(Math.max(dayOfMonth, 1), lastDay);
  return `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function seoulToUtc(
  dateStr: string,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, second, ms));
}

export function dueInstant(dueDate: string | null, dueTime: string | null): Date | null {
  if (!dueDate) return null;
  if (!dueTime) return seoulToUtc(dueDate, 23, 59, 59, 999);
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(dueTime);
  if (!match) return seoulToUtc(dueDate, 23, 59, 59, 999);
  return seoulToUtc(dueDate, Number(match[1]), Number(match[2]), 0, 0);
}

export function startOfWeek(dateStr: string): string {
  const weekday = weekdayOf(dateStr);
  const fromMonday = weekday === 0 ? 6 : weekday - 1;
  return addDays(dateStr, -fromMonday);
}

export function endOfWeek(dateStr: string): string {
  return addDays(startOfWeek(dateStr), 6);
}

export function isBusinessDay(
  dateStr: string,
  holidays: ReadonlySet<string>,
  excludeHolidays: boolean,
): boolean {
  const weekday = weekdayOf(dateStr);
  if (weekday === 0 || weekday === 6) return false;
  if (excludeHolidays && holidays.has(dateStr)) return false;
  return true;
}

export function shiftBusinessDays(
  dateStr: string,
  amount: number,
  holidays: ReadonlySet<string>,
  excludeHolidays: boolean,
): string {
  if (amount === 0) return dateStr;
  let cursor = dateStr;
  let left = Math.abs(amount);
  const step = amount < 0 ? -1 : 1;
  let guard = 0;
  while (left > 0 && guard < 400) {
    cursor = addDays(cursor, step);
    if (isBusinessDay(cursor, holidays, excludeHolidays)) left -= 1;
    guard += 1;
  }
  return cursor;
}

export function minutes(clock: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock);
  if (!match) return 9 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function seoulMinutes(now: Date): number {
  const clock = seoulClock(now);
  return clock.hour * 60 + clock.minute;
}

export function atSeoul(dateStr: string, clock: string): Date {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(clock) ?? ["09:00", "09", "00"];
  return seoulToUtc(dateStr, Number(match[1]), Number(match[2]), 0, 0);
}

export function formatSeoul(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
