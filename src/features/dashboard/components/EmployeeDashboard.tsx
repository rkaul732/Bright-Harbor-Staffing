"use client";

import { useState, type ReactNode } from "react";
import {
  Bookmark,
  CalendarCheck,
  CalendarClock,
  Clock3,
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

type EmployeeModalKey =
  | "post-shift"
  | "time-off"
  | "posted-shifts"
  | "pickup-requests"
  | "scheduled-shifts"
  | "profile"
  | "saved-shifts"
  | "program-notices";

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


  const widgetActions = (
    <>
      <WidgetButton
        label="Time Off Requests"
        count={myTimeOffRequests.length}
        active={activeModal === "time-off"}
        onClick={() => setActiveModal("time-off")}
      />
      {canExchangeShifts ? (
        <>
          <WidgetButton
            label="Posted Shifts"
            count={myCoveragePosts.length}
            active={activeModal === "posted-shifts"}
            onClick={() => setActiveModal("posted-shifts")}
          />
          <WidgetButton
            label="Pick Up Shift"
            count={pickupRequests.length}
            active={activeModal === "pickup-requests"}
            onClick={() => setActiveModal("pickup-requests")}
          />
          <WidgetButton
            label="Scheduled Shifts"
            count={scheduledShifts.length}
            active={activeModal === "scheduled-shifts"}
            onClick={() => setActiveModal("scheduled-shifts")}
          />
          <WidgetButton
            label="Saved Shifts"
            count={savedShifts.length}
            active={activeModal === "saved-shifts"}
            onClick={() => setActiveModal("saved-shifts")}
          />
        </>
      ) : null}
      {visibleAdSlots.length > 0 ? (
        <WidgetButton
          label="Program Notices"
          count={visibleAdSlots.length}
          active={activeModal === "program-notices"}
          onClick={() => setActiveModal("program-notices")}
        />
      ) : null}
    </>
  );

  return (
    <DashboardShell role="employee" data={data} onProfileClick={() => setActiveModal("profile")}>
      {!canExchangeShifts ? (
        <section className="mb-4 rounded-lg border border-harbor-sky/20 bg-white/80 p-3 text-sm leading-6 text-harbor-midnight/70 shadow-line">
          Your selected program access is{" "}
          <span className="font-medium text-harbor-midnight">{programLabel}</span>.
          Choose one or more programs in your profile to unlock shift posting and pickup.
        </section>
      ) : null}

      <MyCalendarBoard
        events={myCalendarEvents}
        programNames={selectedProgramNames}
        availableShifts={canExchangeShifts ? availableShifts : []}
        showShiftTools={canExchangeShifts}
        widgetActions={widgetActions}
        onPostShift={() => setActiveModal("post-shift")}
      />

      <EmployeeWidgetModal
        title="Post Shift"
        eyebrow="Coverage request"
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
        title="Time Off Requests"
        eyebrow="My requests"
        open={activeModal === "time-off"}
        onClose={() => setActiveModal(null)}
      >
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <TimeOffRequestForm programNames={selectedProgramNames} />
          <WidgetList
            emptyIcon={CalendarCheck}
            emptyTitle="No time off requests"
            emptyBody="Submitted requests will appear here."
          >
            {myTimeOffRequests.map((request) => (
              <TimeOffCard key={request.id} request={request} />
            ))}
          </WidgetList>
        </div>
      </EmployeeWidgetModal>

      <EmployeeWidgetModal
        title="Shifts Posted"
        eyebrow="Coverage I put up"
        open={activeModal === "posted-shifts"}
        onClose={() => setActiveModal(null)}
      >
        <WidgetList
          emptyIcon={ClipboardList}
          emptyTitle="No shifts posted"
          emptyBody="When you need coverage, your posts will appear here."
        >
          {myCoveragePosts.map((shift) => (
            <ShiftCard key={shift.id} shift={shift} compact />
          ))}
        </WidgetList>
      </EmployeeWidgetModal>

      <EmployeeWidgetModal
        title="Pickup Requests"
        eyebrow="Requests routed for approval"
        open={activeModal === "pickup-requests"}
        onClose={() => setActiveModal(null)}
      >
        <WidgetList
          emptyIcon={Send}
          emptyTitle="No pickup requests"
          emptyBody="Requests routed for approval will appear here."
        >
          {pickupRequests.map((request) => (
            <PickupRequestCard
              key={request.id}
              request={request}
              shift={visibleShifts.find((shift) => shift.id === request.shift_id)}
            />
          ))}
        </WidgetList>
      </EmployeeWidgetModal>

      <EmployeeWidgetModal
        title="Scheduled Shifts"
        eyebrow="My timeline"
        open={activeModal === "scheduled-shifts"}
        onClose={() => setActiveModal(null)}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <ShiftColumn title="Previous" shifts={previousShifts} />
          <ShiftColumn title="This week" shifts={thisWeekShifts} />
          <ShiftColumn title="Upcoming" shifts={upcomingShifts} />
        </div>
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

      <EmployeeWidgetModal
        title="Saved Shifts"
        eyebrow="For later"
        open={activeModal === "saved-shifts"}
        onClose={() => setActiveModal(null)}
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
      </EmployeeWidgetModal>

      <EmployeeWidgetModal
        title="Program Notices"
        eyebrow="Promoted openings"
        open={activeModal === "program-notices"}
        onClose={() => setActiveModal(null)}
      >
        <AdSlots ads={visibleAdSlots} />
      </EmployeeWidgetModal>
    </DashboardShell>
  );
}

function WidgetButton({
  label,
  count,
  active = false,
  onClick
}: {
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "word-button font-semibold" : "word-button"}
    >
      {label}
      {typeof count === "number" ? (
        <span className="text-xs text-harbor-ocean/70">({count})</span>
      ) : null}
    </button>
  );
}

function EmployeeWidgetModal({
  title,
  eyebrow,
  open,
  onClose,
  children
}: {
  title: string;
  eyebrow: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-harbor-midnight/35 px-3 py-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`employee-modal-${title}`}
    >
      <section className="max-h-[88vh] w-full max-w-5xl overflow-auto rounded-lg border border-white/70 bg-white p-4 shadow-soft sm:p-5">
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
    <div className="grid gap-3 xl:grid-cols-2">
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
      {request.review_comment ? (
        <p className="mt-3 rounded-lg bg-harbor-mist p-3 text-sm leading-6 text-harbor-midnight/70">
          <span className="font-medium text-harbor-midnight">Admin comment:</span>{" "}
          {request.review_comment}
        </p>
      ) : null}
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
      {request.review_comment ? (
        <p className="mt-3 rounded-lg bg-harbor-mist p-3 text-sm leading-6 text-harbor-midnight/70">
          <span className="font-medium text-harbor-midnight">Admin comment:</span>{" "}
          {request.review_comment}
        </p>
      ) : null}
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
