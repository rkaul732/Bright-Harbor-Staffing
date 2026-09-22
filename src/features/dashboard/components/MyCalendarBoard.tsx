"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Send
} from "lucide-react";
import { PROGRAMS } from "@/shared/lib/constants";
import {
  addMonths,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  formatTimeRange,
  getMonthMatrix,
  parseLocalDate,
  todayISO,
  toISODate
} from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { EmptyState } from "@/shared/components/EmptyState";
import { ShiftCard } from "@/shared/components/ShiftCard";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { RequestShiftForm } from "@/features/shifts/components/ShiftActionForms";
import type {
  CalendarMode,
  ProgramName,
  RequestStatus,
  ShiftPost
} from "@/shared/types/domain";

export type MyCalendarEvent = {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  program_name: ProgramName;
  kind: "scheduled_shift" | "posted_shift" | "pickup_request" | "time_off";
  status?: RequestStatus;
  shift?: ShiftPost;
  note?: string | null;
};

function getEventDates(event: MyCalendarEvent) {
  if (!event.endDate || event.endDate === event.date) {
    return [event.date];
  }

  const dates: string[] = [];
  const cursor = parseLocalDate(event.date);
  const end = parseLocalDate(event.endDate);

  while (cursor <= end) {
    dates.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function getKindLabel(kind: MyCalendarEvent["kind"]) {
  if (kind === "scheduled_shift") return "Picked up shift";
  if (kind === "posted_shift") return "Posted shift";
  if (kind === "pickup_request") return "Pickup request";
  return "Time off";
}

function getEventTime(event: MyCalendarEvent) {
  return event.shift ? formatTimeRange(event.shift) : null;
}

export function MyCalendarBoard({
  events,
  programNames,
  availableShifts = [],
  showShiftTools = false
}: {
  events: MyCalendarEvent[];
  programNames: ProgramName[];
  availableShifts?: ShiftPost[];
  showShiftTools?: boolean;
}) {
  const [mode, setMode] = useState<CalendarMode>("month");
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [program, setProgram] = useState<ProgramName | "all">("all");
  const [showOpenShifts, setShowOpenShifts] = useState(false);

  const visibleProgramNames = programNames.length ? programNames : PROGRAMS;
  const filteredEvents = useMemo(() => {
    return events.filter((event) => program === "all" || event.program_name === program);
  }, [events, program]);
  const filteredOpenShifts = useMemo(() => {
    return availableShifts.filter(
      (shift) => program === "all" || shift.program_name === program
    );
  }, [availableShifts, program]);

  const days = getMonthMatrix(monthDate);

  function getEventsForDate(iso: string) {
    return filteredEvents.filter((event) => getEventDates(event).includes(iso));
  }

  function getOpenShiftsForDate(iso: string) {
    return filteredOpenShifts.filter((shift) => shift.shift_date === iso);
  }

  const dayEvents = getEventsForDate(selectedDate);
  const selectedOpenShifts = getOpenShiftsForDate(selectedDate);

  return (
    <section id="my-calendar" className="panel scroll-mt-24 overflow-hidden">
      <div className="border-b border-harbor-ocean/10 bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="label">My Calendar</p>
            <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
              {formatMonthYear(monthDate)}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {showShiftTools ? (
              <>
                <a href="#post-shift" className="secondary-button px-3 py-2">
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                  Post Shift
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setShowOpenShifts((current) => !current);
                    setMode("day");
                  }}
                  aria-pressed={showOpenShifts}
                  className={cn(
                    showOpenShifts ? "primary-button" : "secondary-button",
                    "px-3 py-2"
                  )}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Open Shifts
                  {selectedOpenShifts.length > 0 ? (
                    <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs">
                      {selectedOpenShifts.length}
                    </span>
                  ) : null}
                </button>
              </>
            ) : null}
            <div className="inline-flex rounded-lg bg-harbor-mist p-1">
              <button
                type="button"
                onClick={() => setMode("month")}
                className={cn(
                  "focus-ring rounded-md px-3 py-2 text-sm font-medium",
                  mode === "month"
                    ? "bg-white text-harbor-midnight shadow-line"
                    : "text-harbor-ocean"
                )}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setMode("day")}
                className={cn(
                  "focus-ring rounded-md px-3 py-2 text-sm font-medium",
                  mode === "day"
                    ? "bg-white text-harbor-midnight shadow-line"
                    : "text-harbor-ocean"
                )}
              >
                Day
              </button>
            </div>
            <button
              type="button"
              onClick={() => setMonthDate((date) => addMonths(date, -1))}
              className="secondary-button px-3"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setMonthDate((date) => addMonths(date, 1))}
              className="secondary-button px-3"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 rounded-lg border border-harbor-ocean/10 bg-harbor-mist px-3 py-2 sm:max-w-xs">
          <ListFilter className="h-4 w-4 text-harbor-ocean" aria-hidden="true" />
          <select
            value={program}
            onChange={(event) => setProgram(event.target.value as ProgramName | "all")}
            className="w-full bg-transparent text-sm text-harbor-midnight outline-none"
          >
            <option value="all">All my programs</option>
            {visibleProgramNames.map((programName) => (
              <option key={programName} value={programName}>
                {programName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {mode === "month" ? (
        <div className="p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-harbor-ocean/10 bg-harbor-ocean/10">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="bg-harbor-mist px-2 py-2 text-center text-xs text-harbor-ocean"
              >
                {day}
              </div>
            ))}
            {days.map((day) => {
              const dateEvents = getEventsForDate(day.iso);
              const dateOpenShifts = getOpenShiftsForDate(day.iso);

              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => {
                    setSelectedDate(day.iso);
                    setMode("day");
                  }}
                  className={cn(
                    "min-h-28 min-w-0 bg-white p-2 text-left transition hover:bg-harbor-mist sm:min-h-36",
                    !day.isCurrentMonth && "bg-white/60 text-harbor-midnight/40",
                    selectedDate === day.iso && "ring-2 ring-inset ring-harbor-sky",
                    day.isToday && "bg-harbor-lemon/30"
                  )}
                >
                  <span className="text-xs font-medium">{day.date.getDate()}</span>
                  <div className="mt-2 space-y-1">
                    {dateEvents.slice(0, 3).map((event) => (
                      <span
                        key={`${event.id}-${day.iso}`}
                        className={cn(
                          "block max-w-full truncate rounded-md px-2 py-1 text-[11px] text-harbor-midnight",
                          event.kind === "time_off"
                            ? "bg-harbor-lemon/75"
                            : event.kind === "pickup_request"
                              ? "bg-harbor-sky/20"
                              : event.kind === "posted_shift"
                                ? "bg-harbor-mist"
                                : "bg-emerald-50"
                        )}
                      >
                        {event.program_name}: {getKindLabel(event.kind)}
                      </span>
                    ))}
                    {showOpenShifts && dateOpenShifts.length > 0 ? (
                      <span className="block max-w-full truncate rounded-md bg-harbor-sky/15 px-2 py-1 text-[11px] text-harbor-midnight">
                        {dateOpenShifts.length} open shift
                        {dateOpenShifts.length === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    {dateEvents.length > 3 ? (
                      <span className="block text-[11px] text-harbor-ocean">More</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-5">
          <label className="mb-4 block sm:max-w-xs">
            <span className="label">Selected day</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="field mt-1.5"
            />
          </label>

          <div className="mb-4 flex items-center gap-2 text-harbor-ocean">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            <p className="text-sm">{formatLongDate(selectedDate)}</p>
          </div>

          {dayEvents.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {dayEvents.map((event) => (
                <article
                  key={event.id}
                  className="rounded-lg border border-harbor-ocean/10 bg-white p-4 shadow-line"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="label">{event.program_name}</p>
                      <h3 className="mt-1 text-base font-medium text-harbor-midnight">
                        {event.title}
                      </h3>
                      <p className="mt-1 text-sm text-harbor-midnight/60">
                        {getKindLabel(event.kind)}
                        {getEventTime(event) ? ` - ${getEventTime(event)}` : ""}
                      </p>
                    </div>
                    {event.status ? <StatusBadge value={event.status} /> : null}
                  </div>
                  {event.note ? (
                    <p className="mt-3 text-sm leading-6 text-harbor-midnight/65">
                      {event.note}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-harbor-ocean/20 bg-white/70 p-6 text-center">
              <p className="text-sm text-harbor-midnight/60">
                No calendar items for this day. Try another date or program.
              </p>
            </div>
          )}

          <div className="mt-4 text-xs text-harbor-midnight/50">
            Showing {dayEvents.length} item{dayEvents.length === 1 ? "" : "s"} for{" "}
            {formatShortDate(selectedDate)}.
          </div>
        </div>
      )}

      {showOpenShifts ? (
        <OpenShiftsPanel shifts={selectedOpenShifts} selectedDate={selectedDate} />
      ) : null}
    </section>
  );
}

function OpenShiftsPanel({
  shifts,
  selectedDate
}: {
  shifts: ShiftPost[];
  selectedDate: string;
}) {
  return (
    <div id="open-shifts" className="border-t border-harbor-ocean/10 bg-harbor-mist/50 p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label">Open Shifts</p>
          <h3 className="mt-1 text-lg font-medium text-harbor-midnight">
            Available for {formatLongDate(selectedDate)}
          </h3>
        </div>
        <p className="text-sm text-harbor-midnight/60">
          {shifts.length} shift{shifts.length === 1 ? "" : "s"} available
        </p>
      </div>

      <div className="mt-4">
        {shifts.length > 0 ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {shifts.map((shift) => (
              <ShiftCard key={shift.id} shift={shift}>
                <RequestShiftForm shift={shift} />
              </ShiftCard>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Send}
            title="No open shifts for this date"
            body="Choose another date or program to view available shifts."
          />
        )}
      </div>
    </div>
  );
}
