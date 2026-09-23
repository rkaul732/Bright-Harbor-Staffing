"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, FileSpreadsheet } from "lucide-react";
import { DashboardShell } from "@/shared/components/DashboardShell";
import { EmptyState } from "@/shared/components/EmptyState";
import { downloadExcelReport, type ExcelReportColumn } from "@/features/reports/lib/excelWorkbook";
import {
  formatShortDate,
  parseLocalDate,
  todayISO,
  toISODate
} from "@/shared/lib/dates";
import type {
  DashboardData,
  RequestStatus,
  TimeOffRequest
} from "@/shared/types/domain";

type ReportType = "requests-by-employee" | "requests-by-approval-status" | "flagged-requests";

type TimeOffReportRow = {
  id: string;
  employeeName: string;
  flagDetails: string;
  requestSubmitDate: string;
  timeOffStartDate: string;
  timeOffEndDate: string;
  totalHours: number;
  approvalStatus: string;
  comments: string;
  rawStatus: RequestStatus;
};

type ReportDefinition = {
  title: string;
  description: string;
  columns: ExcelReportColumn<TimeOffReportRow>[];
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

const REPORT_DEFINITIONS: Record<ReportType, ReportDefinition> = {
  "requests-by-employee": {
    title: "Requests By Employee",
    description: "Time off requests grouped by employee using the employee template layout.",
    columns: [
      { header: "Employee Name", key: "employeeName" },
      { header: "Time Off Request Submit Date", key: "requestSubmitDate", type: "date" },
      { header: "Time Off Start Date", key: "timeOffStartDate", type: "date" },
      { header: "Time Off End Date", key: "timeOffEndDate", type: "date" },
      { header: "Total Hours", key: "totalHours", type: "number" },
      { header: "Approval Status", key: "approvalStatus" },
      { header: "Comments", key: "comments" }
    ]
  },
  "requests-by-approval-status": {
    title: "Requests By Approval Status",
    description: "Time off requests grouped by approval status using the approval status template layout.",
    columns: [
      { header: "Approval Status", key: "approvalStatus" },
      { header: "Employee Name", key: "employeeName" },
      { header: "Time Off Request Submit Date", key: "requestSubmitDate", type: "date" },
      { header: "Time Off Start Date", key: "timeOffStartDate", type: "date" },
      { header: "Time Off End Date", key: "timeOffEndDate", type: "date" },
      { header: "Total Hours", key: "totalHours", type: "number" },
      { header: "Comments", key: "comments" }
    ]
  },
  "flagged-requests": {
    title: "Flagged Requests",
    description: "Only requests with HR attention flags, using the flagged requests template layout.",
    columns: [
      { header: "Employee Name", key: "employeeName" },
      { header: "Flag Details", key: "flagDetails" },
      { header: "Time Off Request Submit Date", key: "requestSubmitDate", type: "date" },
      { header: "Time Off Start Date", key: "timeOffStartDate", type: "date" },
      { header: "Time Off End Date", key: "timeOffEndDate", type: "date" },
      { header: "Total Hours", key: "totalHours", type: "number" },
      { header: "Approval Status", key: "approvalStatus" },
      { header: "Comments", key: "comments" }
    ]
  }
};

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

function inclusiveDayCount(startDate: string, endDate: string) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(days, 1);
}

function totalHours(startDate: string, endDate: string) {
  return inclusiveDayCount(startDate, endDate) * 8;
}

function approvalStatusLabel(status: RequestStatus) {
  switch (status) {
    case "approved":
      return "Approved";
    case "declined":
      return "Declined";
    case "cancelled":
      return "Cancelled";
    default:
      return "Pending Supervisor Approval";
  }
}

function commentsForRequest(request: TimeOffRequest) {
  const comments = ["Reason: " + request.reason];

  if (request.review_comment) {
    comments.push("Admin comment: " + request.review_comment);
  }

  return comments.join("; ");
}

function buildTimeOffReportRows(data: DashboardData, hrFlags: Map<string, string[]>) {
  return data.timeOffRequests.map((request) => ({
    id: request.id,
    employeeName: request.employee_name,
    flagDetails: (hrFlags.get(request.id) ?? []).join("; "),
    requestSubmitDate: request.created_at,
    timeOffStartDate: request.start_date,
    timeOffEndDate: request.end_date,
    totalHours: totalHours(request.start_date, request.end_date),
    approvalStatus: approvalStatusLabel(request.status),
    comments: commentsForRequest(request),
    rawStatus: request.status
  }));
}

function rowsForReport(type: ReportType, rows: TimeOffReportRow[]) {
  const reportRows = type === "flagged-requests"
    ? rows.filter((row) => row.flagDetails.length > 0)
    : [...rows];

  if (type === "requests-by-approval-status") {
    return reportRows.sort((first, second) => {
      const statusCompare = first.approvalStatus.localeCompare(second.approvalStatus);
      return statusCompare || first.employeeName.localeCompare(second.employeeName) || first.timeOffStartDate.localeCompare(second.timeOffStartDate);
    });
  }

  if (type === "flagged-requests") {
    return reportRows.sort((first, second) =>
      second.requestSubmitDate.localeCompare(first.requestSubmitDate) || first.employeeName.localeCompare(second.employeeName)
    );
  }

  return reportRows.sort((first, second) =>
    first.employeeName.localeCompare(second.employeeName) || first.timeOffStartDate.localeCompare(second.timeOffStartDate)
  );
}

function displayCell(row: TimeOffReportRow, column: ExcelReportColumn<TimeOffReportRow>) {
  const value = row[column.key];

  if (column.type === "date" && typeof value === "string") {
    return formatShortDate(value.slice(0, 10));
  }

  return String(value ?? "");
}

export function AdminReportsDashboard({ data }: { data: DashboardData }) {
  const [startDate, setStartDate] = useState(firstDayOfCurrentMonth);
  const [endDate, setEndDate] = useState(todayISO);
  const [reportType, setReportType] = useState<ReportType>("requests-by-employee");
  const hrFlags = useMemo(() => buildHrFlagMap(data.timeOffRequests), [data.timeOffRequests]);
  const timeOffRows = useMemo(() => buildTimeOffReportRows(data, hrFlags), [data, hrFlags]);
  const filteredTimeOffRows = useMemo(
    () =>
      timeOffRows.filter((row) => requestDateInRange(row.requestSubmitDate, startDate, endDate)),
    [endDate, startDate, timeOffRows]
  );
  const selectedDefinition = REPORT_DEFINITIONS[reportType];
  const selectedRows = useMemo(
    () => rowsForReport(reportType, filteredTimeOffRows),
    [filteredTimeOffRows, reportType]
  );
  const flaggedRows = filteredTimeOffRows.filter((row) => row.flagDetails.length > 0);
  const pendingRows = filteredTimeOffRows.filter(
    (row) => row.rawStatus === "pending_supervisor_approval"
  );
  const previewRows = selectedRows.slice(0, 12);

  return (
    <DashboardShell role="admin" data={data}>
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="label">Reports</p>
            <h2 className="mt-1 text-2xl font-medium text-harbor-midnight">
              Time off request reports
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-harbor-midnight/62">
              Preview and download time off request reports using the selected Excel template.
              HR attention flags appear when time off patterns match repeated Monday/Friday
              or repeated day-of-week criteria.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[13rem_10rem_10rem_auto] xl:items-end">
            <label className="block sm:col-span-2 xl:col-span-1">
              <span className="label">Report type</span>
              <select
                value={reportType}
                onChange={(event) => setReportType(event.target.value as ReportType)}
                className="field mt-1.5"
              >
                {Object.entries(REPORT_DEFINITIONS).map(([key, definition]) => (
                  <option key={key} value={key}>
                    {definition.title}
                  </option>
                ))}
              </select>
            </label>
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
              onClick={() =>
                downloadExcelReport({
                  title: selectedDefinition.title,
                  columns: selectedDefinition.columns,
                  rows: selectedRows,
                  downloadedOn: todayISO()
                })
              }
              className="word-button font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Download XLSX
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-harbor-ocean/10 bg-harbor-mist/60 px-3 py-2 text-sm leading-6 text-harbor-midnight/68">
          {selectedDefinition.description}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ReportMetric label="Rows in selected report" value={selectedRows.length} />
          <ReportMetric label="Pending approval" value={pendingRows.length} />
          <ReportMetric label="HR flags" value={flaggedRows.length} tone="attention" />
        </div>
      </section>

      <section className="panel mt-5 overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label">Preview</p>
            <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
              {selectedDefinition.title}
            </h2>
          </div>
          <p className="text-sm text-harbor-midnight/55">
            Showing {previewRows.length} of {selectedRows.length} rows
          </p>
        </div>

        {previewRows.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.08em] text-harbor-ocean">
                  {selectedDefinition.columns.map((column) => (
                    <th key={column.header} className="border-b border-harbor-ocean/10 px-3 py-2 font-medium">
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.flagDetails.length > 0 ? "bg-harbor-lemon/30" : "bg-white"}
                  >
                    {selectedDefinition.columns.map((column) => (
                      <td key={row.id + column.key} className="border-b border-harbor-ocean/10 px-3 py-3 align-top text-harbor-midnight/70">
                        {column.key === "flagDetails" && row.flagDetails.length > 0 ? (
                          <div className="flex gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-harbor-ocean" aria-hidden="true" />
                            <span>{row.flagDetails}</span>
                          </div>
                        ) : column.key === "flagDetails" ? (
                          <span className="text-harbor-midnight/35">None</span>
                        ) : column.key === "employeeName" ? (
                          <span className="font-medium text-harbor-midnight">{displayCell(row, column)}</span>
                        ) : (
                          displayCell(row, column)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={AlertTriangle}
              title="No report rows in this view"
              body="Adjust the report type or date range to preview request data. You can still download the empty template."
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
