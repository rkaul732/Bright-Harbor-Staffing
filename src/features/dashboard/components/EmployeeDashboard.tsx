"use client";

import { useState, type ReactNode } from "react";
import {
  Bookmark,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  ClipboardList,
  Send,
  X
} from "lucide-react";
import { DashboardShell } from "@/shared/components/DashboardShell";
import { ShiftCard } from "@/shared/components/ShiftCard";
import { EmptyState } from "@/shared/components/EmptyState";
import { AdSlots } from "@/shared/components/AdSlots";
import { StatusBadge } from "@/shared/components/StatusBadge";
import {
  FIXED_EMERGENCY_PAY_RATE,
  FIXED_STANDARD_PAY_RATE,
  canUseShiftExchange,
  getProfileProgramNames
} from "@/shared/lib/constants";
import { EmployeeCoveragePostForm } from "@/features/shifts/components/ShiftPostForms";
import { RequestShiftForm } from "@/features/shifts/components/ShiftActionForms";
import { WorkerProfileForm } from "@/features/profiles/components/ProfileForms";
import { TimeOffRequestForm } from "@/features/time-off/components/TimeOffForms";
import {
  MyCalendarBoard,
  type MyCalendarEvent
} from "@/features/dashboard/components/MyCalendarBoard";
import { formatLongDate, parseLocalDate, sortShifts, todayISO } from "@/shared/lib/dates";
import type {
  DashboardData,
  ProgramName,
  ShiftPost,
  TimeOffRequest
} from "@/shared/types/domain";

type EmployeeModalKey = "post-shift" | "time-off" | "profile";

function getEmployeeScheduledShifts(data: DashboardData) {
  const approvedShiftIds = data.requests
    .filter(
      (request) =>
        request.requestor_id === data.currentUser.id && request.status === "approved"
    )
    .map((request) => request.shift_id);

  return sortShifts(
    data.shifts.filter((shift) => approvedShiftIds.includes(shift.id))
  );
}

function isInSelectedPrograms(
  programName: ProgramName | string | null | undefined,
  programNames: ProgramName[]
) {
  return Boolean(programName && programNames.includes(programName as ProgramName));
}

function isPriorityWeekendShift(shift: ShiftPost) {
  const day = parseLocalDate(shift.shift_date).getDay();
  return day === 0 || day === 5 || day === 6;
}

function getPriorityAvailableShifts(shifts: ShiftPost[]) {
  const priority = new Map<string, ShiftPost>();

  sortShifts(shifts)
    .filter(isPriorityWeekendShift)
    .slice(0, 6)
    .forEach((shift) => priority.set(shift.id, shift));

  sortShifts(shifts)
    .slice(0, 3)
    .forEach((shift) => priority.set(shift.id, shift));

  return sortShifts([...priority.values()]).slice(0, 9);
}

export function EmployeeDashboard({ data }: { data: DashboardData }) {
  const [activeModal, setActiveModal] = useState<EmployeeModalKey | null>(null);
  const profile = data.workerProfiles.find(
    (workerProfile) => workerProfile.user_id === data.currentUser.id
  );
  const selectedProgramNames = getProfileProgramNames(profile);
  const programLabel = selectedProgramNames.length
    ? selectedProgramNames.join(", ")
    : "No programs selected";
  const canExchangeShifts = canUseShiftExchange(selectedProgramNames);
  const visibleShifts = data.shifts.filter((shift) =>
    isInSelectedPrograms(shift.program_name, selectedProgramNames)
  );
  const visibleShiftIds = new Set(visibleShifts.map((shift) => shift.id));
  const visibleData = { ...data, shifts: visibleShifts };
  const scheduledShifts = getEmployeeScheduledShifts(visibleData);
  const pickupRequests = data.requests.filter(
    (request) =>
      request.requestor_id === data.currentUser.id && visibleShiftIds.has(request.shift_id)
  );
  const myCoveragePosts = sortShifts(
    visibleShifts.filter((shift) => shift.owner_user_id === data.currentUser.id)
  );
  const availableShifts = sortShifts(
    visibleShifts.filter(
      (shift) =>
        shift.status === "open" &&
        shift.owner_user_id !== data.currentUser.id &&
        shift.openings > shift.filled_openings
    )
  );
  const priorityAvailableShifts = getPriorityAvailableShifts(availableShifts);
  const myTimeOffRequests = [...data.timeOffRequests]
    .filter(
      (request) =>
        request.user_id === data.currentUser.id &&
        isInSelectedPrograms(request.program_name, selectedProgramNames)
    )
    .sort((first, second) => first.start_date.localeCompare(second.start_date));
  const visibleAdSlots = data.adSlots.filter((ad) =>
    isInSelectedPrograms(ad.program_name, selectedProgramNames)
  );
  const myCalendarEvents: MyCalendarEvent[] = [
    ...scheduledShifts.map((shift) => ({
      id: `scheduled-${shift.id}`,
      title: shift.title,
      date: shift.shift_date,
      program_name: shift.program_name,
      kind: "scheduled_shift" as const,
      status: "approved" as const,
      shift,
      note: shift.details
    })),
    ...myCoveragePosts.map((shift) => ({
      id: `posted-${shift.id}`,
      title: shift.title,
      date: shift.shift_date,
      program_name: shift.program_name,
      kind: "posted_shift" as const,
      status: shift.status === "cancelled" ? "cancelled" as const : undefined,
      shift,
      note: shift.details
    })),
    ...pickupRequests
      .filter((request) => request.status !== "approved")
      .flatMap((request): MyCalendarEvent[] => {
        const shift = visibleShifts.find((item) => item.id === request.shift_id);
        return shift
          ? [
              {
                id: `pickup-${request.id}`,
                title: shift.title,
                date: shift.shift_date,
                program_name: shift.program_name,
                kind: "pickup_request" as const,
                status: request.status,
                shift,
                note: request.note
              }
            ]
          : [];
      }),
    ...myTimeOffRequests.map((request) => ({
      id: `time-off-${request.id}`,
      title: "Time off request",
      date: request.start_date,
      endDate: request.end_date,
      program_name: request.program_name,
      kind: "time_off" as const,
      status: request.status,
      note: request.reason
    }))
  ];


  const recentTimeOffRequests = [...myTimeOffRequests]
    .sort((first, second) => second.created_at.localeCompare(first.created_at))
    .slice(0, 3);
  const recentCoveragePosts = [...myCoveragePosts]
    .sort((first, second) => second.created_at.localeCompare(first.created_at))
    .slice(0, 3);
  const recentSavedShifts = data.savedShifts
    .filter((saved) => saved.user_id === data.currentUser.id && visibleShiftIds.has(saved.shift_id))
    .sort((first, second) => second.created_at.localeCompare(first.created_at))
    .flatMap((saved) => {
      const shift = visibleShifts.find((item) => item.id === saved.shift_id);
      return shift ? [shift] : [];
    })
    .slice(0, 3);

  return (
    <DashboardShell role="employee" data={data} onProfileClick={() => setActiveModal("profile")}>
      {!canExchangeShifts ? (
        <section className="mb-4 rounded-lg border border-harbor-sky/20 bg-white/80 p-3 text-sm leading-6 text-harbor-midnight/70 shadow-line">
          Your selected program access is{" "}
          <span className="font-medium text-harbor-midnight">{programLabel}</span>.
          Choose one or more programs in your profile to unlock shift posting and pickup.
        </section>
      ) : null}

      <EmployeeRequestOverview
        requests={myTimeOffRequests}
        programLabel={programLabel}
        onRequestTimeOff={() => setActiveModal("time-off")}
      />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]">
        <div className="min-w-0">
          <MyCalendarBoard
            events={myCalendarEvents}
            programNames={selectedProgramNames}
            availableShifts={canExchangeShifts ? availableShifts : []}
            showShiftTools={canExchangeShifts}
            onRequestTimeOff={() => setActiveModal("time-off")}
            onPostShift={() => setActiveModal("post-shift")}
          />
        </div>
        <EmployeeRightMenu
          priorityShifts={priorityAvailableShifts}
          timeOffRequests={recentTimeOffRequests}
          postedShifts={recentCoveragePosts}
          savedShifts={recentSavedShifts}
          ads={visibleAdSlots}
          showShiftWidgets={canExchangeShifts}
        />
      </div>

      <EmployeeWidgetModal
        title="Post Shift"
        eyebrow="Coverage request"
        maxWidth="medium"
        open={activeModal === "post-shift"}
        onClose={() => setActiveModal(null)}
      >
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full border border-harbor-ocean/10 bg-white px-3 py-2 text-harbor-midnight/72">
            Standard: ${FIXED_STANDARD_PAY_RATE.toFixed(2)} hourly
          </span>
          <span className="rounded-full border border-harbor-lemon bg-harbor-lemon/60 px-3 py-2 text-harbor-midnight/72">
            Emergency: ${FIXED_EMERGENCY_PAY_RATE.toFixed(2)} hourly
          </span>
        </div>
        <EmployeeCoveragePostForm programNames={selectedProgramNames} />
      </EmployeeWidgetModal>

      <EmployeeWidgetModal
        title="Request Time Off"
        eyebrow="Submit for approval"
        maxWidth="compact"
        open={activeModal === "time-off"}
        onClose={() => setActiveModal(null)}
      >
        <TimeOffRequestForm programNames={selectedProgramNames} />
      </EmployeeWidgetModal>

      <EmployeeWidgetModal
        title="My Profile"
        eyebrow="Profile settings"
        open={activeModal === "profile"}
        onClose={() => setActiveModal(null)}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusBadge value={profile?.status ?? "pending_supervisor_approval"} />
          <p className="text-sm text-harbor-midnight/60">Programs: {programLabel}</p>
        </div>
        <WorkerProfileForm data={data} />
      </EmployeeWidgetModal>
    </DashboardShell>
  );
}

function EmployeeRequestOverview({
  requests,
  programLabel,
  onRequestTimeOff
}: {
  requests: TimeOffRequest[];
  programLabel: string;
  onRequestTimeOff: () => void;
}) {
  const pending = requests.filter(
    (request) => request.status === "pending_supervisor_approval"
  ).length;
  const approved = requests.filter((request) => request.status === "approved").length;
  const declined = requests.filter((request) => request.status === "declined").length;
  const upcoming =
    requests.find((request) => request.end_date >= todayISO()) ??
    [...requests].sort((first, second) => second.created_at.localeCompare(first.created_at))[0];

  return (
    <section className="mb-4 grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]">
      <div className="panel p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="label">Employee requests</p>
            <h1 className="mt-1 text-2xl font-medium leading-tight text-harbor-midnight sm:text-3xl">
              Request time off with a clear review trail.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-harbor-midnight/62">
              Submit dates for approval, then watch the status update here and on your
              calendar. Your current program access is {programLabel}.
            </p>
          </div>
          <button type="button" onClick={onRequestTimeOff} className="primary-button shrink-0">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            Request Time Off
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <EmployeeQueueMetric
            icon={CalendarClock}
            label="Pending"
            value={pending}
            detail="Awaiting review"
          />
          <EmployeeQueueMetric
            icon={CalendarCheck}
            label="Approved"
            value={approved}
            detail="Confirmed time off"
          />
          <EmployeeQueueMetric
            icon={CalendarX}
            label="Declined"
            value={declined}
            detail="Needs follow up"
          />
        </div>
      </div>

      <div className="panel p-3 sm:p-4">
        <p className="label">Current queue</p>
        {upcoming ? (
          <div className="mt-3 rounded-lg border border-harbor-ocean/10 bg-harbor-mist/60 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-harbor-midnight">
                  {formatLongDate(upcoming.start_date)}
                </p>
                <p className="mt-1 text-xs text-harbor-midnight/55">
                  Through {formatLongDate(upcoming.end_date)}
                </p>
              </div>
              <StatusBadge value={upcoming.status} />
            </div>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-harbor-midnight/65">
              {upcoming.reason}
            </p>
          </div>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="No time off submitted"
            body="Use Request Time Off when you need a day reviewed."
          />
        )}
      </div>
    </section>
  );
}

function EmployeeQueueMetric({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: typeof CalendarClock;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-harbor-ocean/10 bg-white p-3 shadow-line">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.06em] text-harbor-midnight/55">
          {label}
        </p>
        <Icon className="h-4 w-4 text-harbor-ocean" aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-medium text-harbor-midnight">{value}</p>
      <p className="mt-1 text-xs text-harbor-midnight/55">{detail}</p>
    </div>
  );
}

function EmployeeRightMenu({
  priorityShifts,
  timeOffRequests,
  postedShifts,
  savedShifts,
  ads,
  showShiftWidgets
}: {
  priorityShifts: ShiftPost[];
  timeOffRequests: TimeOffRequest[];
  postedShifts: ShiftPost[];
  savedShifts: ShiftPost[];
  ads: DashboardData["adSlots"];
  showShiftWidgets: boolean;
}) {
  return (
    <aside className="min-w-0 space-y-3">
      {showShiftWidgets ? (
        <EmployeeSideWidget
          title="Priority open shifts"
          subtitle="Weekends and nearest openings"
          count={priorityShifts.length}
        >
          <WidgetList
            emptyIcon={Send}
            emptyTitle="No priority openings"
            emptyBody="Open Friday, Saturday, Sunday, and nearest shifts will appear here."
          >
            {priorityShifts.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} compact>
                <RequestShiftForm shift={shift} />
              </ShiftCard>
            ))}
          </WidgetList>
        </EmployeeSideWidget>
      ) : null}
      <EmployeeSideWidget
        title="Time off requests"
        subtitle="Most recent requests"
        count={timeOffRequests.length}
      >
        <WidgetList
          emptyIcon={CalendarClock}
          emptyTitle="No time off requests"
          emptyBody="Submitted requests will appear here."
        >
          {timeOffRequests.map((request) => (
            <TimeOffCard key={request.id} request={request} />
          ))}
        </WidgetList>
      </EmployeeSideWidget>

      {showShiftWidgets ? (
        <EmployeeSideWidget
          title="Posted shifts"
          subtitle="Most recent coverage posts"
          count={postedShifts.length}
        >
          <WidgetList
            emptyIcon={ClipboardList}
            emptyTitle="No posted shifts"
            emptyBody="Your coverage posts will appear here."
          >
            {postedShifts.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} compact />
            ))}
          </WidgetList>
        </EmployeeSideWidget>
      ) : null}

      {showShiftWidgets ? (
        <EmployeeSideWidget
          title="Saved shifts"
          subtitle="Most recent saved openings"
          count={savedShifts.length}
        >
          <WidgetList
            emptyIcon={Bookmark}
            emptyTitle="No saved shifts"
            emptyBody="Saved openings will appear here."
          >
            {savedShifts.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} compact />
            ))}
          </WidgetList>
        </EmployeeSideWidget>
      ) : null}

      {ads.length > 0 ? (
        <EmployeeSideWidget
          title="Program notices"
          subtitle="Promoted openings"
          count={ads.length}
        >
          <AdSlots ads={ads} />
        </EmployeeSideWidget>
      ) : null}
    </aside>
  );
}

function EmployeeSideWidget({
  title,
  subtitle,
  count,
  children
}: {
  title: string;
  subtitle: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-harbor-ocean/10 bg-white/95 p-3 shadow-line">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="label">{subtitle}</p>
          <h2 className="mt-1 text-base font-medium text-harbor-midnight">{title}</h2>
        </div>
        <span className="rounded-full border border-harbor-sky/20 bg-harbor-mist px-2 py-0.5 text-xs font-medium text-harbor-ocean">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function EmployeeWidgetModal({
  title,
  eyebrow,
  maxWidth = "wide",
  open,
  onClose,
  children
}: {
  title: string;
  eyebrow: string;
  maxWidth?: "compact" | "medium" | "wide";
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  const widthClass =
    maxWidth === "compact" ? "max-w-2xl" : maxWidth === "medium" ? "max-w-3xl" : "max-w-5xl";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-harbor-midnight/35 px-3 py-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`employee-modal-${title}`}
    >
      <section className={`max-h-[88vh] w-full ${widthClass} overflow-auto rounded-lg border border-white/70 bg-white p-4 shadow-soft sm:p-5`}>
        <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-start justify-between gap-4 border-b border-harbor-ocean/10 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-5 sm:-mt-5 sm:px-5">
          <div>
            <p className="label">{eyebrow}</p>
            <h2
              id={`employee-modal-${title}`}
              className="mt-1 text-xl font-medium text-harbor-midnight"
            >
              {title}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="ghost-button px-1.5" aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function WidgetList({
  emptyIcon,
  emptyTitle,
  emptyBody,
  children
}: {
  emptyIcon: typeof CalendarClock;
  emptyTitle: string;
  emptyBody: string;
  children: ReactNode[];
}) {
  const items = children.filter(Boolean);

  return (
    <div className="grid gap-3">
      {items.length > 0 ? (
        items
      ) : (
        <EmptyState icon={emptyIcon} title={emptyTitle} body={emptyBody} />
      )}
    </div>
  );
}

function TimeOffCard({ request }: { request: TimeOffRequest }) {
  return (
    <article className="rounded-lg border border-harbor-ocean/10 bg-white p-3 shadow-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-harbor-midnight">
            {formatLongDate(request.start_date)}
          </p>
          <p className="mt-1 text-xs text-harbor-midnight/55">
            Through {formatLongDate(request.end_date)}
          </p>
        </div>
        <StatusBadge value={request.status} />
      </div>
      <p className="mt-3 text-sm leading-6 text-harbor-midnight/65">
        {request.reason}
      </p>
      <p className="mt-2 text-xs text-harbor-midnight/50">
        {request.program_name}
      </p>
      {request.review_comment ? (
        <p className="mt-3 rounded-lg bg-harbor-mist p-3 text-sm leading-6 text-harbor-midnight/70">
          <span className="font-medium text-harbor-midnight">Admin comment:</span>{" "}
          {request.review_comment}
        </p>
      ) : null}
    </article>
  );
}
