"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { DashboardShell } from "@/shared/components/DashboardShell";
import { EmptyState } from "@/shared/components/EmptyState";
import { StatusBadge } from "@/shared/components/StatusBadge";
import {
  formatShortDate,
  formatTimeRange,
  parseLocalDate,
  todayISO,
  toISODate
} from "@/shared/lib/dates";
import type {
  DashboardData,
  RequestStatus,
  ShiftStatus,
  TimeOffRequest
} from "@/shared/types/domain";

type ReportRow = {
  id: string;
  type: "Time off request" | "Pickup request" | "Posted shift for coverage";
  employeeName: string;
  employeeId: string;
  programName: string;
  requestDate: string;
  coverageDate: string;
  timeFrame: string;
  status: RequestStatus | ShiftStatus;
  reason: string;
  reviewComment: string;
  hrFlags: string[];
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

function firstDayOfCurrentMonth() {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function expandTimeOffDates(request: TimeOffRequest) {
  const dates: Date[] = [];
  const cursor = parseLocalDate(request.start_date);
  const end = parseLocalDate(request.end_date);

  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function addFlag(
  flagsByRequestId: Map<string, Set<string>>,
  requestId: string,
  message: string
) {
  const flags = flagsByRequestId.get(requestId) ?? new Set<string>();
  flags.add(message);
  flagsByRequestId.set(requestId, flags);
}

function buildHrFlagMap(requests: TimeOffRequest[]) {
  const flagsByRequestId = new Map<string, Set<string>>();
  const requestsByUser = new Map<string, TimeOffRequest[]>();

  requests.forEach((request) => {
    const items = requestsByUser.get(request.user_id) ?? [];
    items.push(request);
    requestsByUser.set(request.user_id, items);
  });

  requestsByUser.forEach((userRequests) => {
    const sorted = [...userRequests].sort((first, second) =>
      first.start_date.localeCompare(second.start_date)
    );

    sorted.forEach((anchorRequest) => {
      const anchorStart = parseLocalDate(anchorRequest.start_date);
      const windowStart = addDays(anchorStart, -41);
      const weekendWraparoundRequestIds = new Set<string>();
      const requestsByDay = new Map<number, Set<string>>();

      sorted.forEach((request) => {
        const matchingDates = expandTimeOffDates(request).filter(
          (date) => date >= windowStart && date <= anchorStart
        );

        matchingDates.forEach((date) => {
          const day = date.getDay();

          if (day === 1 || day === 5) {
            weekendWraparoundRequestIds.add(request.id);
          }

          const dayRequests = requestsByDay.get(day) ?? new Set<string>();
          dayRequests.add(request.id);
          requestsByDay.set(day, dayRequests);
        });
      });

      if (weekendWraparoundRequestIds.size >= 4) {
        weekendWraparoundRequestIds.forEach((requestId) =>
          addFlag(
            flagsByRequestId,
            requestId,
            "Weekend wraparound pattern: 4+ Monday/Friday time off requests in 6 weeks"
          )
        );
      }

      requestsByDay.forEach((requestIds, day) => {
        if (requestIds.size > 4) {
          requestIds.forEach((requestId) =>
            addFlag(
              flagsByRequestId,
              requestId,
              "Repeated " + DAY_NAMES[day] + " pattern: more than 4 requests in 6 weeks"
            )
          );
        }
      });
    });
  });

  return new Map(
    [...flagsByRequestId.entries()].map(([requestId, flags]) => [
      requestId,
      [...flags]
    ])
  );
}

function requestDateInRange(value: string, startDate: string, endDate: string) {
  const date = value.slice(0, 10);
  return date >= startDate && date <= endDate;
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return "\"" + text.replaceAll("\"", "\"\"") + "\"";
}

function downloadRows(rows: ReportRow[], startDate: string, endDate: string) {
  const headers = [
    "Employee Name",
    "Employee ID",
    "Request Type",
    "Program",
    "Date Requested",
    "Coverage/Time Off Date",
    "Time Frame",
    "Status",
    "Reason/Details",
    "Review Comment",
    "HR Flags"
  ];
  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        row.employeeName,
        row.employeeId,
        row.type,
        row.programName,
        row.requestDate.slice(0, 10),
        row.coverageDate,
        row.timeFrame,
        row.status,
        row.reason,
        row.reviewComment,
        row.hrFlags.join("; ")
      ]
        .map(csvCell)
        .join(",")
    )
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download =
    "bright-harbor-staffing-requests-by-name-" +
    todayISO() +
    "-" +
    startDate +
    "-to-" +
    endDate +
    ".csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildReportRows(data: DashboardData, hrFlags: Map<string, string[]>) {
  const usersById = new Map(data.users.map((user) => [user.id, user]));
  const shiftsById = new Map(data.shifts.map((shift) => [shift.id, shift]));

  const timeOffRows: ReportRow[] = data.timeOffRequests.map((request) => ({
    id: "time-off-" + request.id,
    type: "Time off request",
    employeeName: request.employee_name,
    employeeId: request.user_id,
    programName: request.program_name,
    requestDate: request.created_at,
    coverageDate:
      request.start_date === request.end_date
        ? request.start_date
        : request.start_date + " to " + request.end_date,
    timeFrame: "Time off",
    status: request.status,
    reason: request.reason,
    reviewComment: request.review_comment ?? "",
    hrFlags: hrFlags.get(request.id) ?? []
  }));

  const pickupRows: ReportRow[] = data.requests.map((request) => {
    const shift = shiftsById.get(request.shift_id);

    return {
      id: "pickup-" + request.id,
      type: "Pickup request",
      employeeName: request.requestor_name,
      employeeId: request.requestor_id,
      programName: shift?.program_name ?? "Program pending",
      requestDate: request.created_at,
      coverageDate: shift?.shift_date ?? "Shift pending",
      timeFrame: shift ? formatTimeRange(shift) : "Shift pending",
      status: request.status,
      reason: request.note ?? "",
      reviewComment: request.review_comment ?? "",
      hrFlags: []
    };
  });

  const postedShiftRows: ReportRow[] = data.shifts
    .filter((shift) => shift.posted_by_role === "employee" && shift.owner_user_id)
    .map((shift) => {
      const employee = shift.owner_user_id ? usersById.get(shift.owner_user_id) : null;

      return {
        id: "posted-" + shift.id,
        type: "Posted shift for coverage",
        employeeName: employee?.full_name ?? "Employee",
        employeeId: shift.owner_user_id ?? "",
        programName: shift.program_name,
        requestDate: shift.created_at,
        coverageDate: shift.shift_date,
        timeFrame: formatTimeRange(shift),
        status: shift.status,
        reason: shift.details ?? "",
        reviewComment: "",
        hrFlags: []
      };
    });

  return [...timeOffRows, ...pickupRows, ...postedShiftRows].sort((first, second) => {
    const nameCompare = first.employeeName.localeCompare(second.employeeName);
    return nameCompare || second.requestDate.localeCompare(first.requestDate);
  });
}

export function AdminReportsDashboard({ data }: { data: DashboardData }) {
  const [startDate, setStartDate] = useState(firstDayOfCurrentMonth);
  const [endDate, setEndDate] = useState(todayISO);
  const hrFlags = useMemo(() => buildHrFlagMap(data.timeOffRequests), [data.timeOffRequests]);
  const reportRows = useMemo(() => buildReportRows(data, hrFlags), [data, hrFlags]);
  const filteredRows = useMemo(
    () =>
      reportRows.filter((row) => requestDateInRange(row.requestDate, startDate, endDate)),
    [endDate, reportRows, startDate]
  );
  const flaggedRows = filteredRows.filter((row) => row.hrFlags.length > 0);
  const pendingRows = filteredRows.filter(
    (row) => row.status === "pending_supervisor_approval" || row.status === "open"
  );
  const previewRows = filteredRows.slice(0, 12);

  return (
    <DashboardShell role="admin" data={data}>
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="label">Reports</p>
            <h2 className="mt-1 text-2xl font-medium text-harbor-midnight">
              Request data by employee
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-harbor-midnight/62">
              Preview and download employee request activity for a selected date range.
              HR attention flags appear when time off patterns match repeated Monday/Friday
              or repeated day-of-week criteria.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block">
              <span className="label">Start</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="field mt-1.5"
              />
            </label>
            <label className="block">
              <span className="label">End</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="field mt-1.5"
              />
            </label>
            <button
              type="button"
              onClick={() => downloadRows(filteredRows, startDate, endDate)}
              className="word-button font-semibold"
              disabled={filteredRows.length === 0}
            >
              Download Spreadsheet
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ReportMetric label="Rows in range" value={filteredRows.length} />
          <ReportMetric label="Pending or open" value={pendingRows.length} />
          <ReportMetric label="HR flags" value={flaggedRows.length} tone="attention" />
        </div>
      </section>

      <section className="panel mt-5 overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label">Preview</p>
            <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
              Spreadsheet preview
            </h2>
          </div>
          <p className="text-sm text-harbor-midnight/55">
            Showing {previewRows.length} of {filteredRows.length} rows
          </p>
        </div>

        {previewRows.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.08em] text-harbor-ocean">
                  <th className="border-b border-harbor-ocean/10 px-3 py-2 font-medium">Employee</th>
                  <th className="border-b border-harbor-ocean/10 px-3 py-2 font-medium">Type</th>
                  <th className="border-b border-harbor-ocean/10 px-3 py-2 font-medium">Program</th>
                  <th className="border-b border-harbor-ocean/10 px-3 py-2 font-medium">Requested</th>
                  <th className="border-b border-harbor-ocean/10 px-3 py-2 font-medium">Date</th>
                  <th className="border-b border-harbor-ocean/10 px-3 py-2 font-medium">Status</th>
                  <th className="border-b border-harbor-ocean/10 px-3 py-2 font-medium">HR Flags</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.hrFlags.length > 0 ? "bg-harbor-lemon/30" : "bg-white"}
                  >
                    <td className="border-b border-harbor-ocean/10 px-3 py-3 align-top">
                      <p className="font-medium text-harbor-midnight">{row.employeeName}</p>
                      <p className="mt-1 text-xs text-harbor-midnight/45">{row.employeeId}</p>
                    </td>
                    <td className="border-b border-harbor-ocean/10 px-3 py-3 align-top text-harbor-midnight/70">
                      {row.type}
                    </td>
                    <td className="border-b border-harbor-ocean/10 px-3 py-3 align-top text-harbor-midnight/70">
                      {row.programName}
                    </td>
                    <td className="border-b border-harbor-ocean/10 px-3 py-3 align-top text-harbor-midnight/70">
                      {formatShortDate(row.requestDate.slice(0, 10))}
                    </td>
                    <td className="border-b border-harbor-ocean/10 px-3 py-3 align-top text-harbor-midnight/70">
                      <p>{row.coverageDate}</p>
                      <p className="mt-1 text-xs text-harbor-midnight/45">{row.timeFrame}</p>
                    </td>
                    <td className="border-b border-harbor-ocean/10 px-3 py-3 align-top">
                      <StatusBadge value={row.status} />
                    </td>
                    <td className="border-b border-harbor-ocean/10 px-3 py-3 align-top text-harbor-midnight/70">
                      {row.hrFlags.length > 0 ? (
                        <div className="flex gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-harbor-ocean" aria-hidden="true" />
                          <span>{row.hrFlags.join("; ")}</span>
                        </div>
                      ) : (
                        <span className="text-harbor-midnight/35">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={AlertTriangle}
              title="No report rows in this range"
              body="Adjust the start and end dates to preview request data."
            />
          </div>
        )}
      </section>
    </DashboardShell>
  );
}

function ReportMetric({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: number;
  tone?: "default" | "attention";
}) {
  return (
    <div className="rounded-lg border border-harbor-ocean/10 bg-white p-4 shadow-line">
      <p className="text-sm text-harbor-midnight/55">{label}</p>
      <p
        className={
          tone === "attention"
            ? "mt-2 text-2xl font-medium text-harbor-ocean"
            : "mt-2 text-2xl font-medium text-harbor-midnight"
        }
      >
        {value}
      </p>
    </div>
  );
}
