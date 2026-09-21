"use client";

import {
  Bookmark,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Clock3,
  ClipboardList,
  Send
} from "lucide-react";
import { DashboardShell } from "@/shared/components/DashboardShell";
import { MetricCard } from "@/shared/components/MetricCard";
import { CalendarBoard } from "@/shared/components/CalendarBoard";
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
import {
  RequestShiftForm,
  SaveShiftForm
} from "@/features/shifts/components/ShiftActionForms";
import { EmployeeCoveragePostForm } from "@/features/shifts/components/ShiftPostForms";
import { WorkerProfileForm } from "@/features/profiles/components/ProfileForms";
import { TimeOffRequestForm } from "@/features/time-off/components/TimeOffForms";
import {
  MyCalendarBoard,
  type MyCalendarEvent
} from "@/features/dashboard/components/MyCalendarBoard";
import {
  formatLongDate,
  isPastShift,
  isThisWeek,
  isUpcomingShift,
  sortShifts
} from "@/shared/lib/dates";
import type {
  DashboardData,
  ProgramName,
  ShiftPost,
  ShiftRequest,
  TimeOffRequest
} from "@/shared/types/domain";

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

function shiftActions(shift: ShiftPost) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <RequestShiftForm shift={shift} />
      <SaveShiftForm shift={shift} />
    </div>
  );
}

export function EmployeeDashboard({ data }: { data: DashboardData }) {
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
  const previousShifts = scheduledShifts.filter(isPastShift);
  const thisWeekShifts = scheduledShifts.filter(isThisWeek);
  const upcomingShifts = scheduledShifts.filter(isUpcomingShift);
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
  const savedShiftIds = data.savedShifts
    .filter((saved) => saved.user_id === data.currentUser.id)
    .map((saved) => saved.shift_id);
  const savedShifts = visibleShifts.filter((shift) => savedShiftIds.includes(shift.id));
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

  return (
    <DashboardShell role="employee" data={data}>
      <section
        className={
          canExchangeShifts
            ? "mb-5 grid gap-3 sm:grid-cols-4"
            : "mb-5 grid gap-3 sm:grid-cols-2"
        }
      >
        <a href="#my-calendar" className="primary-button py-3">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          My Calendar
        </a>
        {canExchangeShifts ? (
          <>
            <a href="#post-shift" className="secondary-button py-3">
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Post Shift
            </a>
            <a href="#pick-up-shift" className="secondary-button py-3">
              <Send className="h-4 w-4" aria-hidden="true" />
              Pick Up Shift
            </a>
          </>
        ) : null}
        <a
          href="#time-off-requests"
          className="secondary-button py-3"
        >
          <CalendarCheck className="h-4 w-4" aria-hidden="true" />
          Time Off Requests
        </a>
      </section>

      {!canExchangeShifts ? (
        <section className="mb-5 rounded-lg border border-harbor-sky/20 bg-white/85 p-4 text-sm leading-6 text-harbor-midnight/70 shadow-line">
          Your selected program access is{" "}
          <span className="font-medium text-harbor-midnight">{programLabel}</span>.
          Shift posting and pickup are available only when at least one selected
          program is Anchor, Beacon, Beach, Chelsea, Wave, or Code Red/Code Blue.
        </section>
      ) : null}

      <div className="mb-5">
        <MyCalendarBoard
          events={myCalendarEvents}
          programNames={selectedProgramNames}
        />
      </div>

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Time off requests"
          value={myTimeOffRequests.length}
          icon={CalendarCheck}
          tone="sky"
        />
        <MetricCard
          label="Shifts posted"
          value={canExchangeShifts ? myCoveragePosts.length : 0}
          icon={ClipboardList}
        />
        <MetricCard
          label="Pickup requests"
          value={canExchangeShifts ? pickupRequests.length : 0}
          icon={Send}
          tone="lemon"
        />
        <MetricCard
          label="Scheduled shifts"
          value={canExchangeShifts ? scheduledShifts.length : 0}
          icon={CalendarClock}
        />
      </section>

      <section className="mb-5 grid gap-5 xl:grid-cols-3">
        <EmployeeListPanel
          label="Time off requests"
          emptyTitle="No time off requests"
          emptyBody="Submitted requests will appear here."
          icon={CalendarCheck}
        >
          {myTimeOffRequests.map((request) => (
            <TimeOffCard key={request.id} request={request} />
          ))}
        </EmployeeListPanel>

        {canExchangeShifts ? (
          <>
            <EmployeeListPanel
              label="Shifts put up for coverage"
              emptyTitle="No shifts posted"
              emptyBody="When you need coverage, your posts will appear here."
              icon={Clock3}
            >
              {myCoveragePosts.map((shift) => (
                <ShiftCard key={shift.id} shift={shift} compact />
              ))}
            </EmployeeListPanel>

            <EmployeeListPanel
              label="Requests to pick up shifts"
              emptyTitle="No pickup requests"
              emptyBody="Requests routed for approval will appear here."
              icon={Send}
            >
              {pickupRequests.map((request) => (
                <PickupRequestCard
                  key={request.id}
                  request={request}
                  shift={visibleShifts.find((shift) => shift.id === request.shift_id)}
                />
              ))}
            </EmployeeListPanel>
          </>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_21rem]">
        <div className="min-w-0 space-y-5">
          <section id="time-off-requests" className="panel scroll-mt-24 p-4 sm:p-5">
            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="label">Time Off Requests</p>
                <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
                  Request time away
                </h2>
                <p className="mt-2 text-sm leading-6 text-harbor-midnight/60">
                  Submit planned time away and track approval status from your
                  dashboard.
                </p>
                <div className="mt-4">
                  <TimeOffRequestForm programNames={selectedProgramNames} />
                </div>
              </div>
              <div className="min-w-0">
                <p className="label">My requests</p>
                <div className="mt-3 space-y-3">
                  {myTimeOffRequests.length > 0 ? (
                    myTimeOffRequests.map((request) => (
                      <TimeOffCard key={request.id} request={request} />
                    ))
                  ) : (
                    <EmptyState
                      icon={CalendarCheck}
                      title="No time off requests"
                      body="Your submitted requests will appear here."
                    />
                  )}
                </div>
              </div>
            </div>
          </section>

          {canExchangeShifts ? (
            <>
              <section id="pick-up-shift" className="scroll-mt-24">
                <CalendarBoard
                  title="Available shifts to cover"
                  shifts={availableShifts}
                  actions={shiftActions}
                />
              </section>

              <section className="grid gap-5 xl:grid-cols-2">
                <div id="post-shift" className="panel scroll-mt-24 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="label">Post Shift</p>
                      <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
                        Put one of your shifts up
                      </h2>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full border border-harbor-ocean/10 bg-white px-3 py-2 text-harbor-midnight/72">
                      Standard: ${FIXED_STANDARD_PAY_RATE.toFixed(2)} hourly
                    </span>
                    <span className="rounded-full border border-harbor-lemon bg-harbor-lemon/60 px-3 py-2 text-harbor-midnight/72">
                      Emergency: ${FIXED_EMERGENCY_PAY_RATE.toFixed(2)} hourly
                    </span>
                  </div>
                  <div className="mt-4">
                    <EmployeeCoveragePostForm programNames={selectedProgramNames} />
                  </div>
                </div>

                <section className="panel p-4 sm:p-5">
                  <p className="label">My shift timeline</p>
                  <div className="mt-4 grid gap-4">
                    <ShiftColumn title="Previous" shifts={previousShifts} />
                    <ShiftColumn title="This week" shifts={thisWeekShifts} />
                    <ShiftColumn title="Upcoming" shifts={upcomingShifts} />
                  </div>
                </section>
              </section>
            </>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-5">
          <section className="panel p-4 sm:p-5">
            <p className="label">Employee profile</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-medium text-harbor-midnight">
                Program and availability
              </h2>
              {profile ? (
                <StatusBadge value={profile.status} />
              ) : (
                <StatusBadge value="pending_supervisor_approval" />
              )}
            </div>
            <p className="mt-2 text-sm text-harbor-midnight/60">
              Programs: {programLabel}
            </p>
            <div className="mt-4">
              <WorkerProfileForm data={data} />
            </div>
          </section>

          {canExchangeShifts ? (
            <section className="panel p-4">
              <p className="label">Saved shifts</p>
              <div className="mt-3 space-y-3">
                {savedShifts.length > 0 ? (
                  savedShifts.map((shift) => (
                    <ShiftCard key={shift.id} shift={shift} compact />
                  ))
                ) : (
                  <EmptyState
                    icon={Bookmark}
                    title="No saved shifts"
                    body="Saved openings will appear here."
                  />
                )}
              </div>
            </section>
          ) : null}

          <AdSlots ads={visibleAdSlots} />
        </aside>
      </div>
    </DashboardShell>
  );
}

function EmployeeListPanel({
  label,
  emptyTitle,
  emptyBody,
  icon: Icon,
  children
}: {
  label: string;
  emptyTitle: string;
  emptyBody: string;
  icon: typeof CalendarClock;
  children: React.ReactNode[];
}) {
  const items = children.filter(Boolean);

  return (
    <section className="panel p-4">
      <p className="label">{label}</p>
      <div className="mt-3 max-h-[26rem] space-y-3 overflow-auto pr-1">
        {items.length > 0 ? (
          items
        ) : (
          <EmptyState icon={Icon} title={emptyTitle} body={emptyBody} />
        )}
      </div>
    </section>
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
    </article>
  );
}

function PickupRequestCard({
  request,
  shift
}: {
  request: ShiftRequest;
  shift?: ShiftPost;
}) {
  return (
    <article className="rounded-lg border border-harbor-ocean/10 bg-white p-3 shadow-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-harbor-midnight">
            {shift?.title ?? "Shift request"}
          </p>
          <p className="mt-1 text-xs text-harbor-midnight/55">
            {shift?.location_name ?? "Location pending"}
          </p>
        </div>
        <StatusBadge value={request.status} />
      </div>
      <p className="mt-3 text-xs text-harbor-midnight/60">
        Routed to {request.supervisor_email}
      </p>
    </article>
  );
}

function ShiftColumn({ title, shifts }: { title: string; shifts: ShiftPost[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-harbor-midnight">{title}</h3>
      <div className="mt-3 space-y-3">
        {shifts.length > 0 ? (
          shifts.map((shift) => <ShiftCard key={shift.id} shift={shift} compact />)
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="No shifts"
            body="Nothing is listed in this group yet."
          />
        )}
      </div>
    </div>
  );
}
