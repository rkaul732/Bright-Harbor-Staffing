import type { ShiftPost } from "@/shared/types/domain";

export function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function todayISO() {
  return toISODate(new Date());
}

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function getMonthMatrix(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      iso: toISODate(date),
      isCurrentMonth: date.getMonth() === month,
      isToday: toISODate(date) === todayISO()
    };
  });
}

export function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(parseLocalDate(value));
}

export function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(parseLocalDate(value));
}

export function formatTimeRange(shift: Pick<ShiftPost, "start_time" | "end_time">) {
  return `${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`;
}

export function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(2025, 0, 1, hours, minutes));
}

export function shiftDateTime(shift: ShiftPost) {
  return new Date(`${shift.shift_date}T${shift.start_time}`);
}

export function isPastShift(shift: ShiftPost) {
  return shiftDateTime(shift).getTime() < Date.now();
}

export function isThisWeek(shift: ShiftPost) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  const date = shiftDateTime(shift);
  return date >= start && date < end;
}

export function isUpcomingShift(shift: ShiftPost) {
  return shiftDateTime(shift).getTime() >= Date.now();
}

export function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

export function sortShifts(shifts: ShiftPost[]) {
  return [...shifts].sort(
    (first, second) => shiftDateTime(first).getTime() - shiftDateTime(second).getTime()
  );
}
