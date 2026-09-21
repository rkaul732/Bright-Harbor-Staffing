"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ListFilter } from "lucide-react";
import { LOCATIONS } from "@/shared/lib/constants";
import {
  addMonths,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  getMonthMatrix,
  todayISO
} from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { ShiftCard } from "@/shared/components/ShiftCard";
import type { CalendarMode, LocationName, ShiftPost } from "@/shared/types/domain";

export function CalendarBoard({
  title,
  shifts,
  emptyLabel = "No shifts for this date.",
  actions
}: {
  title: string;
  shifts: ShiftPost[];
  emptyLabel?: string;
  actions?: (shift: ShiftPost) => React.ReactNode;
}) {
  const [mode, setMode] = useState<CalendarMode>("month");
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [location, setLocation] = useState<LocationName | "all">("all");

  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => location === "all" || shift.location_name === location);
  }, [location, shifts]);

  const dayShifts = filteredShifts.filter((shift) => shift.shift_date === selectedDate);
  const days = getMonthMatrix(monthDate);

  function getShiftsForDate(iso: string) {
    return filteredShifts.filter((shift) => shift.shift_date === iso).slice(0, 3);
  }

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-harbor-ocean/10 bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="label">{title}</p>
            <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
              {formatMonthYear(monthDate)}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
      </div>

      {mode === "month" ? (
        <div className="p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-harbor-ocean/10 bg-harbor-ocean/10">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="bg-harbor-mist px-2 py-2 text-center text-xs text-harbor-ocean">
                {day}
              </div>
            ))}
            {days.map((day) => {
              const dateShifts = getShiftsForDate(day.iso);

              return (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => {
                    setSelectedDate(day.iso);
                    setMode("day");
                  }}
                  className={cn(
                    "min-h-24 min-w-0 bg-white p-2 text-left transition hover:bg-harbor-mist sm:min-h-32",
                    !day.isCurrentMonth && "bg-white/60 text-harbor-midnight/40",
                    selectedDate === day.iso && "ring-2 ring-inset ring-harbor-sky",
                    day.isToday && "bg-harbor-lemon/30"
                  )}
                >
                  <span className="text-xs font-medium">{day.date.getDate()}</span>
                  <div className="mt-2 space-y-1">
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
                    {getShiftsForDate(day.iso).length < filteredShifts.filter((shift) => shift.shift_date === day.iso).length ? (
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
