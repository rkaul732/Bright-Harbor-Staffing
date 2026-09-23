"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ListFilter } from "lucide-react";
import { LOCATIONS } from "@/shared/lib/constants";
import {
  addMonths,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  getMonthMatrix,
  parseLocalDate,
  todayISO,
  toISODate
} from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { ShiftCard } from "@/shared/components/ShiftCard";
import { StatusBadge } from "@/shared/components/StatusBadge";
import type {
  CalendarMode,
  LocationName,
  ShiftPost,
  TimeOffRequest
} from "@/shared/types/domain";

type CalendarViewMode = CalendarMode | "by-name";

function getTimeOffDates(request: TimeOffRequest) {
  const dates: string[] = [];
  const cursor = parseLocalDate(request.start_date);
  const end = parseLocalDate(request.end_date);

  while (cursor <= end) {
    dates.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function getTimeOffStatusClass(status: TimeOffRequest["status"]) {
  if (status === "approved") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "declined" || status === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-harbor-sky/25 bg-harbor-sky/10 text-harbor-ocean";
}

export function CalendarBoard({
  title,
  shifts,
  emptyLabel = "No shifts for this date.",
  actions,
  timeOffRequests = [],
  showByNameView = false,
  initialMode = "month",
  headerAction
}: {
  title: string;
  shifts: ShiftPost[];
  emptyLabel?: string;
  actions?: (shift: ShiftPost) => React.ReactNode;
  timeOffRequests?: TimeOffRequest[];
  showByNameView?: boolean;
  initialMode?: CalendarViewMode;
  headerAction?: React.ReactNode;
}) {
  const [mode, setMode] = useState<CalendarViewMode>(() =>
    initialMode === "by-name" && !showByNameView ? "month" : initialMode
  );
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [location, setLocation] = useState<LocationName | "all">("all");

  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => location === "all" || shift.location_name === location);
  }, [location, shifts]);

  const timeOffByDate = useMemo(() => {
    const byDate = new Map<string, TimeOffRequest[]>();
    const visibleRequests = timeOffRequests.filter(
      (request) =>
        request.status === "approved" ||
        request.status === "pending_supervisor_approval"
    );

    visibleRequests.forEach((request) => {
      getTimeOffDates(request).forEach((date) => {
        const requests = byDate.get(date) ?? [];
        requests.push(request);
        byDate.set(date, requests);
      });
    });

    byDate.forEach((requests, date) => {
      byDate.set(
        date,
        [...requests].sort((first, second) =>
          first.employee_name.localeCompare(second.employee_name)
        )
      );
    });

    return byDate;
  }, [timeOffRequests]);

  const dayShifts = filteredShifts.filter((shift) => shift.shift_date === selectedDate);
  const days = getMonthMatrix(monthDate);

  function getShiftsForDate(iso: string) {
    return filteredShifts.filter((shift) => shift.shift_date === iso);
  }

  function renderCalendarChrome() {
    return (
      <div className="border-b border-harbor-ocean/10 bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="label">{title}</p>
            <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
              {formatMonthYear(monthDate)}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {headerAction}
            <button
              type="button"
              onClick={() => setMode("month")}
              className={mode === "month" ? "word-button font-semibold" : "word-button"}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setMode("day")}
              className={mode === "day" ? "word-button font-semibold" : "word-button"}
            >
              Day
            </button>
            {showByNameView ? (
              <button
                type="button"
                onClick={() => setMode("by-name")}
                className={mode === "by-name" ? "word-button font-semibold" : "word-button"}
              >
                By Name
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setMonthDate((date) => addMonths(date, -1))}
              className="ghost-button px-2 py-2"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setMonthDate((date) => addMonths(date, 1))}
              className="ghost-button px-2 py-2"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {mode !== "by-name" ? (
          <label className="mt-4 flex items-center gap-2 rounded-lg border border-harbor-ocean/10 bg-harbor-mist px-3 py-2 sm:max-w-xs">
            <ListFilter className="h-4 w-4 text-harbor-ocean" aria-hidden="true" />
            <select
              value={location}
              onChange={(event) => setLocation(event.target.value as LocationName | "all")}
              className="w-full bg-transparent text-sm text-harbor-midnight outline-none"
            >
              <option value="all">All locations</option>
              {LOCATIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    );
  }

  function renderShiftMonth() {
    return (
      <div className="p-2 sm:p-4">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-harbor-ocean/10 bg-harbor-ocean/10">
          {renderWeekdayHeaders()}
          {days.map((day) => {
            const allDateShifts = getShiftsForDate(day.iso);
            const dateShifts = allDateShifts.slice(0, 2);

            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => {
                  setSelectedDate(day.iso);
                  setMode("day");
                }}
                className={cn(
                  "flex aspect-square min-h-0 min-w-0 flex-col items-start justify-start overflow-hidden bg-white p-2 text-left transition hover:bg-harbor-mist",
                  !day.isCurrentMonth && "bg-white/60 text-harbor-midnight/40",
                  selectedDate === day.iso && "ring-2 ring-inset ring-harbor-sky",
                  day.isToday && "bg-harbor-lemon/30"
                )}
              >
                <span className="self-start text-xs font-medium leading-none">{day.date.getDate()}</span>
                <div className="mt-2 w-full min-w-0 space-y-1 overflow-hidden">
                  {dateShifts.map((shift) => (
                    <span
                      key={shift.id}
                      className={cn(
                        "block max-w-full truncate rounded-md px-2 py-1 text-[11px] text-harbor-midnight",
                        shift.category === "emergency"
                          ? "bg-harbor-lemon"
                          : shift.urgent
                            ? "bg-harbor-sky/20"
                            : "bg-harbor-mist"
                      )}
                    >
                      {shift.location_name}
                    </span>
                  ))}
                  {dateShifts.length < allDateShifts.length ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-harbor-ocean">
                      <ChevronDown className="h-3 w-3" aria-hidden="true" />
                      {allDateShifts.length - dateShifts.length} more
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderByNameMonth() {
    return (
      <div className="p-2 sm:p-4">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-harbor-ocean/10 bg-harbor-ocean/10">
          {renderWeekdayHeaders()}
          {days.map((day) => {
            const requests = timeOffByDate.get(day.iso) ?? [];
            const visibleRequests = requests.slice(0, 3);

            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => setSelectedDate(day.iso)}
                className={cn(
                  "flex aspect-square min-h-0 min-w-0 flex-col items-start justify-start overflow-hidden bg-white p-2 text-left transition hover:bg-harbor-mist",
                  !day.isCurrentMonth && "bg-white/60 text-harbor-midnight/40",
                  selectedDate === day.iso && "ring-2 ring-inset ring-harbor-sky",
                  day.isToday && "bg-harbor-lemon/30"
                )}
              >
                <span className="self-start text-xs font-medium leading-none">{day.date.getDate()}</span>
                <div className="mt-2 w-full min-w-0 space-y-1 overflow-hidden">
                  {visibleRequests.map((request) => (
                    <span
                      key={`${request.id}-${day.iso}`}
                      className={cn(
                        "block max-w-full truncate rounded-md border px-2 py-1 text-[11px]",
                        getTimeOffStatusClass(request.status)
                      )}
                    >
                      {request.employee_name}
                    </span>
                  ))}
                  {visibleRequests.length < requests.length ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-harbor-ocean">
                      <ChevronDown className="h-3 w-3" aria-hidden="true" />
                      {requests.length - visibleRequests.length} more
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderWeekdayHeaders() {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
      <div
        key={day}
        className="bg-harbor-mist px-2 py-2 text-center text-xs text-harbor-ocean"
      >
        {day}
      </div>
    ));
  }

  return (
    <section className="panel overflow-hidden">
      {renderCalendarChrome()}

      {mode === "month" ? (
        renderShiftMonth()
      ) : mode === "by-name" ? (
        renderByNameMonth()
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

          {dayShifts.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {dayShifts.map((shift) => (
                <ShiftCard key={shift.id} shift={shift} compact>
                  {actions?.(shift)}
                </ShiftCard>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-harbor-ocean/20 bg-white/70 p-6 text-center">
              <p className="text-sm text-harbor-midnight/60">
                {emptyLabel} Try another day or location filter.
              </p>
            </div>
          )}

          <div className="mt-4 text-xs text-harbor-midnight/50">
            Showing {dayShifts.length} shift{dayShifts.length === 1 ? "" : "s"} for{" "}
            {formatShortDate(selectedDate)}.
          </div>
        </div>
      )}
    </section>
  );
}
