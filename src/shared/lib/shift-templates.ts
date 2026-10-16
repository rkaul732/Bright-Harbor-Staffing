import {
  CODE_RED_BLUE_PROGRAM,
  CODE_RED_BLUE_SUPERVISOR_EMAIL,
  FIXED_STANDARD_PAY_RATE
} from "@/shared/lib/constants";
import { parseLocalDate, toISODate } from "@/shared/lib/dates";
import type { ShiftPost } from "@/shared/types/domain";

const GENERATED_CODE_RED_PREFIX = "c0de0000";
const CODE_RED_START_TIME = "10:30";
const CODE_RED_END_TIME = "17:30";

export const CODE_RED_COVERAGE_OPTIONS = [
  {
    value: "full",
    label: "Full shift",
    detail: "10:30 AM - 5:30 PM"
  },
  {
    value: "half-11-3",
    label: "Half shift",
    detail: "11:00 AM - 3:00 PM"
  },
  {
    value: "half-11-4",
    label: "Half shift",
    detail: "11:00 AM - 4:00 PM"
  }
] as const;

export type CodeRedCoverageOption = (typeof CODE_RED_COVERAGE_OPTIONS)[number]["value"];

export const CODE_RED_SHIFT_TEMPLATES = [
  { slug: "standard-1", title: "Code Red/Code Blue Standard 1" },
  { slug: "standard-2", title: "Code Red/Code Blue Standard 2" },
  { slug: "standard-3", title: "Code Red/Code Blue Standard 3" },
  { slug: "housing-benefits", title: "Code Red/Code Blue Housing/Benefits" },
  { slug: "outreach-sos", title: "Code Red/Code Blue Outreach SOS" },
  { slug: "per-diem", title: "Code Red/Code Blue Per Diem" }
] as const;

type CodeRedShiftTemplate = (typeof CODE_RED_SHIFT_TEMPLATES)[number];

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function hashTemplateKey(value: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

function createGeneratedId(date: string, slug: string) {
  const first = hashTemplateKey(date + ":" + slug + ":a");
  const second = hashTemplateKey(date + ":" + slug + ":b");
  const third = hashTemplateKey(date + ":" + slug + ":c");

  return [
    GENERATED_CODE_RED_PREFIX,
    first.slice(0, 4),
    "4" + first.slice(5, 8),
    "8" + second.slice(1, 4),
    second.slice(4, 8) + third
  ].join("-");
}

export function isCodeRedShift(shift: Pick<ShiftPost, "program_name">) {
  return shift.program_name === CODE_RED_BLUE_PROGRAM;
}

export function getCodeRedCoverageOption(value: string | null | undefined) {
  return CODE_RED_COVERAGE_OPTIONS.find((option) => option.value === value) ?? CODE_RED_COVERAGE_OPTIONS[0];
}

export function getCodeRedTemplateFromTitle(title: string) {
  return CODE_RED_SHIFT_TEMPLATES.find((template) => template.title === title) ?? null;
}

export function getCodeRedTemplateFromSlug(slug: string) {
  return CODE_RED_SHIFT_TEMPLATES.find((template) => template.slug === slug) ?? null;
}

export function getCodeRedWeekDates(startDate: string) {
  const start = parseLocalDate(startDate);

  return Array.from({ length: 7 }, (_, index) => toISODate(addDays(start, index)));
}

export function getCodeRedAvailabilityDates(startDate: string) {
  const start = parseLocalDate(startDate);

  return Array.from({ length: 14 }, (_, index) => toISODate(addDays(start, index)));
}

export function createCodeRedShift(
  date: string,
  template: CodeRedShiftTemplate,
  createdBy: string
): ShiftPost {
  const createdAt = new Date().toISOString();

  return {
    id: createGeneratedId(date, template.slug),
    title: template.title,
    details:
      "Daily Code Red/Code Blue coverage. Employees may request the full shift or half-shift coverage from 11 AM-3 PM or 11 AM-4 PM.",
    program_name: CODE_RED_BLUE_PROGRAM,
    location_name: "Toms River",
    shift_date: date,
    start_time: CODE_RED_START_TIME,
    end_time: CODE_RED_END_TIME,
    requirements: ["Direct care"],
    openings: 2,
    filled_openings: 0,
    pay_rate: FIXED_STANDARD_PAY_RATE,
    category: "standard",
    urgent: false,
    status: "open",
    created_by: createdBy,
    posted_by_role: "supervisor",
    owner_user_id: null,
    supervisor_email: CODE_RED_BLUE_SUPERVISOR_EMAIL,
    created_at: createdAt,
    updated_at: createdAt
  };
}

export type CodeRedDayStaffing = "empty" | "unfilled" | "partial" | "full";

export function getCodeRedDayStaffing(shifts: ShiftPost[], date: string): CodeRedDayStaffing {
  const activeShifts = shifts.filter(
    (shift) => isCodeRedShift(shift) && shift.shift_date === date &&
      shift.status !== "cancelled" && shift.status !== "draft"
  );

  if (activeShifts.length === 0) return "empty";

  const openings = activeShifts.reduce((sum, shift) => sum + shift.openings, 0);
  const filled = activeShifts.reduce((sum, shift) => sum + shift.filled_openings, 0);

  if (filled === 0) return "unfilled";
  return filled >= openings ? "full" : "partial";
}
