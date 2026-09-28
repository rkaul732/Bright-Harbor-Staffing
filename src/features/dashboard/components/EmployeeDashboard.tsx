"use client";

import { useState, type ReactNode } from "react";
import {
  Bookmark,
  CalendarClock,
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
import { formatLongDate, sortShifts } from "@/shared/lib/dates";
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

function EmployeeRightMenu({
  timeOffRequests,
  postedShifts,
  savedShifts,
  ads,
  showShiftWidgets
}: {
  timeOffRequests: TimeOffRequest[];
  postedShifts: ShiftPost[];
  savedShifts: ShiftPost[];
  ads: DashboardData["adSlots"];
  showShiftWidgets: boolean;
}) {
  return (
    <aside className="min-w-0 space-y-3">
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
