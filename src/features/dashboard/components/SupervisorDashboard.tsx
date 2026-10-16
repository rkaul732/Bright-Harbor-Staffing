"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { CalendarCheck, CalendarClock, CalendarPlus, CalendarX, ClipboardList, ListFilter, UsersRound, X } from "lucide-react";
import { DashboardShell } from "@/shared/components/DashboardShell";
import { ProgramSelectOptions } from "@/shared/components/ProgramSelectOptions";
import { MetricCard } from "@/shared/components/MetricCard";
import { CalendarBoard } from "@/shared/components/CalendarBoard";
import { ShiftCard } from "@/shared/components/ShiftCard";
import { EmptyState } from "@/shared/components/EmptyState";
import { AdSlots } from "@/shared/components/AdSlots";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { SupervisorProfileForm } from "@/features/profiles/components/ProfileForms";
import { SupervisorShiftPostForm } from "@/features/shifts/components/ShiftPostForms";
import { CodeRedShiftCreationForm } from "@/features/shifts/components/CodeRedShiftCreationForm";
import { AdminOutOfOfficeForm } from "@/features/time-off/components/TimeOffForms";
import {
  CancelShiftForm,
  RescheduleShiftForm
} from "@/features/shifts/components/ShiftActionForms";
import { updateRequestStatusAction, updateTimeOffRequestStatusAction } from "@/app/actions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
import { ProfileModerationControls } from "@/features/admin/components/ProfileModerationControls";
import { StaffAccountInviteForm } from "@/features/admin/components/StaffAccountInviteForm";
import { formatLongDate, sortShifts } from "@/shared/lib/dates";
import { CODE_RED_BLUE_PROGRAM, PROGRAMS, ROLE_LABELS, getProgramLabel, getRelatedProgramNames } from "@/shared/lib/constants";
import { hasSuperAdminAccess } from "@/shared/lib/access";
import { isNewPendingRequest } from "@/features/dashboard/lib/request-status";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/browser";
import type {
  AdminProfile,
  AppRole,
  DashboardData,
  ProgramName,
  ShiftPost,
  ShiftRequest,
  SupervisorProfile,
  TimeOffRequest,
  WorkerProfile
} from "@/shared/types/domain";

function workerProgramNames(profile: WorkerProfile) {
  return profile.program_names?.length ? profile.program_names : [profile.program_name];
}

function requestViewKey(kind: "shift" | "time-off", id: string) {
  return `${kind}:${id}`;
}

function programOptionsForData(data: DashboardData) {
  const currentAdminProfile = data.adminProfiles.find(
    (profile) => profile.user_id === data.currentUser.id
  );
  if (data.currentUser.role === "admin" && currentAdminProfile) {
    return currentAdminProfile.is_super_admin
      ? PROGRAMS
      : PROGRAMS.filter((programName) => currentAdminProfile.program_names.includes(programName));
  }

  const currentSupervisorProfile = data.supervisorProfiles.find(
    (profile) => profile.user_id === data.currentUser.id
  );
  if (data.currentUser.role === "supervisor" && currentSupervisorProfile) {
    return PROGRAMS.filter((programName) => currentSupervisorProfile.program_names.includes(programName));
  }

  const programs = new Set<ProgramName>();

  data.shifts.forEach((shift) => programs.add(shift.program_name));
  data.timeOffRequests.forEach((request) => programs.add(request.program_name));
  data.workerProfiles.forEach((profile) => {
    workerProgramNames(profile).forEach((programName) => programs.add(programName));
  });
  data.supervisorProfiles.forEach((profile) => {
    profile.program_names.forEach((programName) => programs.add(programName));
  });
  data.adminProfiles.forEach((profile) => {
    profile.program_names.forEach((programName) => programs.add(programName));
  });
  data.adSlots.forEach((adSlot) => {
    if (PROGRAMS.includes(adSlot.program_name as ProgramName)) {
      programs.add(adSlot.program_name as ProgramName);
    }
  });

  return PROGRAMS.filter((programName) => programs.has(programName));
}

function filterDashboardDataByProgram(
  data: DashboardData,
  programName: ProgramName | "all"
): DashboardData {
  if (programName === "all") {
    return data;
  }

  const relatedPrograms = new Set(getRelatedProgramNames(programName));
  const shifts = data.shifts.filter((shift) => relatedPrograms.has(shift.program_name));
  const shiftIds = new Set(shifts.map((shift) => shift.id));
  const workerProfiles = data.workerProfiles.filter((profile) =>
    workerProgramNames(profile).some((name) => relatedPrograms.has(name))
  );
  const timeOffRequests = data.timeOffRequests.filter(
    (request) => relatedPrograms.has(request.program_name)
  );
  const requests = data.requests.filter((request) => shiftIds.has(request.shift_id));
  const visibleUserIds = new Set<string>([data.currentUser.id]);

  workerProfiles.forEach((profile) => visibleUserIds.add(profile.user_id));
  timeOffRequests.forEach((request) => visibleUserIds.add(request.user_id));
  requests.forEach((request) => visibleUserIds.add(request.requestor_id));
  shifts.forEach((shift) => {
    visibleUserIds.add(shift.created_by);
    if (shift.owner_user_id) {
      visibleUserIds.add(shift.owner_user_id);
    }
  });

  return {
    ...data,
    users: data.users.filter((user) => visibleUserIds.has(user.id)),
    shifts,
    requests,
    timeOffRequests,
    workerProfiles,
    adSlots: data.adSlots.filter((adSlot) => relatedPrograms.has(adSlot.program_name as ProgramName))
  };
}

export function SupervisorDashboard({
  data,
  role = "supervisor",
  showAdminModeration = false
}: {
  data: DashboardData;
  role?: AppRole;
  showAdminModeration?: boolean;
}) {
  const allShifts = sortShifts(data.shifts);
  const openShifts = allShifts.filter((shift) => shift.status === "open");
  const coveredShifts = allShifts.filter((shift) => shift.status === "covered");
  const pendingRequests = data.requests.filter(
    (request) => request.status === "pending_supervisor_approval"
  );
  const pendingTimeOffRequests = data.timeOffRequests.filter(
    (request) => request.status === "pending_supervisor_approval"
  );

  if (role === "admin" || role === "supervisor") {
    return (
      <AdminDashboardHome
        data={data}
        role={role}
        showAdminModeration={showAdminModeration || role === "supervisor"}
      />
    );
  }

  return (
    <DashboardShell role={role} data={data}>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <div className="min-w-0 space-y-5">
          {(role as AppRole) === "admin" ? (
            <section className="rounded-lg border border-harbor-sky/20 bg-harbor-sky/10 p-4 sm:p-5">
              <p className="label">Approval queue</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <h2 className="text-2xl font-medium text-harbor-midnight">
                  {pendingRequests.length} request
                  {pendingRequests.length === 1 ? "" : "s"} pending supervisor approval
                </h2>
                <p className="text-sm text-harbor-midnight/60">
                  {pendingTimeOffRequests.length} time off request
                  {pendingTimeOffRequests.length === 1 ? "" : "s"} also pending
                </p>
              </div>
            </section>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="All shifts available"
              value={allShifts.length}
              icon={ClipboardList}
              tone="sky"
            />
            <MetricCard label="Open shifts" value={openShifts.length} icon={CalendarClock} />
            <MetricCard
              label="Covered"
              value={coveredShifts.length}
              icon={CalendarCheck}
              tone="lemon"
            />
            <MetricCard
              label="Pending approvals"
              value={pendingRequests.length}
              icon={UsersRound}
            />
          </section>

          <CalendarBoard
            title="Staffing calendar"
            shifts={allShifts}
            timeOffRequests={(role as AppRole) === "admin" ? data.timeOffRequests : undefined}
            showByNameView={(role as AppRole) === "admin"}
          />

          <section className="grid min-w-0 gap-4 xl:grid-cols-2">
            <div className="panel p-4 sm:p-5">
              <p className="label">Post available shifts</p>
              <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
                Add coverage need
              </h2>
              <div className="mt-4">
                <SupervisorShiftPostForm role={role} />
              </div>
            </div>

            {(role as AppRole) === "supervisor" ? (
              <div className="panel p-4 sm:p-5">
                <p className="label">Location profile</p>
                <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
                  Program location setup
                </h2>
                <div className="mt-4">
                  <SupervisorProfileForm />
                </div>
              </div>
            ) : (
              <AdminAnalyticsInset data={data} />
            )}
          </section>

          <AdminRequestsWorkspace data={data} role={role} />

          <section className="panel p-4 sm:p-5">
            <p className="label">Manage and reschedule</p>
            <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
              Shift operations
            </h2>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {allShifts.length > 0 ? (
                allShifts.slice(0, 8).map((shift) => (
                  <ShiftCard key={shift.id} shift={shift}>
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-medium text-harbor-ocean">
                        Manage shift
                      </summary>
                      <div className="mt-4 space-y-4">
                        <RescheduleShiftForm shift={shift} role={role} />
                        <CancelShiftForm shift={shift} role={role} />
                      </div>
                    </details>
                  </ShiftCard>
                ))
              ) : (
                <EmptyState
                  icon={CalendarClock}
                  title="No shifts yet"
                  body="Post an available shift to start building the schedule."
                />
              )}
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5">
          <section className="panel p-4">
            <p className="label">Open shift summary</p>
            <div className="mt-3 space-y-3">
              {openShifts.slice(0, 5).map((shift) => (
                <ShiftCard key={shift.id} shift={shift} compact />
              ))}
              {openShifts.length === 0 ? (
                <EmptyState
                  icon={CalendarCheck}
                  title="No open shifts"
                  body="All current postings are covered."
                />
              ) : null}
            </div>
          </section>

          {showAdminModeration ? <AdminModeration data={data} /> : null}
          <AdSlots ads={data.adSlots} />
        </aside>
      </div>
    </DashboardShell>
  );
}

function AdminDashboardHome({
  data,
  role,
  showAdminModeration
}: {
  data: DashboardData;
  role: AppRole;
  showAdminModeration: boolean;
}) {
  const programOptions = useMemo(() => programOptionsForData(data), [data]);
  const [programFilter, setProgramFilter] = useState<ProgramName | "all">("all");
  const [showOooForm, setShowOooForm] = useState(false);
  const [showCodeRedShiftForm, setShowCodeRedShiftForm] = useState(false);
  const [viewedRequestKeys, setViewedRequestKeys] = useState(
    () => new Set(data.requestViews.map((view) => requestViewKey(view.request_kind, view.request_id)))
  );
  const [reviewError, setReviewError] = useState<string | null>(null);
  const visibleData = useMemo(
    () => filterDashboardDataByProgram(data, programFilter),
    [data, programFilter]
  );
  const visibleAllShifts = sortShifts(visibleData.shifts);
  const codeRedSupervisor = role === "supervisor" && data.supervisorProfiles.some(
    (profile) => profile.user_id === data.currentUser.id && profile.status === "approved" && profile.program_names.includes(CODE_RED_BLUE_PROGRAM)
  );
  const codeRedShifts = sortShifts(data.shifts.filter((shift) => shift.program_name === CODE_RED_BLUE_PROGRAM));
  const otherVisibleShifts = visibleAllShifts.filter((shift) => shift.program_name !== CODE_RED_BLUE_PROGRAM);
  const visibleOpenShifts = visibleAllShifts.filter((shift) => shift.status === "open");
  const visibleCoveredShifts = visibleAllShifts.filter((shift) => shift.status === "covered");
  const requestItems = [
    ...visibleData.requests.map((request) => ({ kind: "shift" as const, request })),
    ...visibleData.timeOffRequests.map((request) => ({ kind: "time-off" as const, request }))
  ];
  const isNew = (item: (typeof requestItems)[number]) => isNewPendingRequest(
    item.request,
    data.currentUser,
    viewedRequestKeys.has(requestViewKey(item.kind, item.request.id))
  );
  const newRequestCount = requestItems.filter(isNew).length;
  const pendingRequestCount = requestItems.filter(
    (item) => item.request.status === "pending_supervisor_approval" && !isNew(item)
  ).length;
  const approvedRequestCount = requestItems.filter((item) => item.request.status === "approved").length;
  const deniedRequestCount = requestItems.filter((item) => item.request.status === "declined").length;
  const canManageAccountTypes = hasSuperAdminAccess(data);
  const roleLabel = ROLE_LABELS[role];

  async function markReviewed(kind: "shift" | "time-off", requestId: string) {
    setReviewError(null);

    if (!data.isDemo) {
      const { error } = await createSupabaseBrowserClient().from("request_views").insert({
        reviewer_id: data.currentUser.id,
        request_kind: kind,
        request_id: requestId
      });

      if (error && error.code !== "23505") {
        setReviewError("Could not mark this request as reviewed. Please try again.");
        return;
      }
    }

    setViewedRequestKeys((current) => new Set(current).add(requestViewKey(kind, requestId)));
  }

  return (
    <DashboardShell role={role} data={data}>
      <section className="relative overflow-hidden rounded-2xl border border-harbor-ocean/10 bg-white p-5 shadow-soft sm:p-7">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-harbor-sky via-harbor-ocean to-harbor-lemon" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="label text-harbor-sky">{roleLabel} Dashboard</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-harbor-midnight sm:text-4xl">
              Welcome, {data.currentUser.full_name}!
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-harbor-ocean/15 bg-harbor-mist px-3 py-1.5 text-sm text-harbor-midnight/70">
              <ListFilter className="h-4 w-4 text-harbor-ocean" aria-hidden="true" />
              <select
                value={programFilter}
                onChange={(event) => setProgramFilter(event.target.value as ProgramName | "all")}
                className="bg-transparent text-sm outline-none"
              >
                <option value="all">All assigned programs</option>
                <ProgramSelectOptions allowedProgramNames={programOptions} />
              </select>
            </label>
            <Link href="/reports" className="word-button font-semibold">
              Reports
            </Link>
            {canManageAccountTypes ? (
              <Link href="/employees/account-types" className="word-button font-semibold">
                Account Types
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminSnapshotCard label="New since sign on" value={newRequestCount} />
          <AdminSnapshotCard label="Still pending" value={pendingRequestCount} />
          <AdminSnapshotCard label="Approved" value={approvedRequestCount} />
          <AdminSnapshotCard label="Denied" value={deniedRequestCount} />
        </div>
      </section>

      <section className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="min-w-0 space-y-4">
          <AdminRequestsWorkspace
            data={visibleData}
            role={role}
            viewedRequestKeys={viewedRequestKeys}
            onMarkReviewed={markReviewed}
            reviewError={reviewError}
          />

          {codeRedSupervisor ? (
            <CalendarBoard
              title="Code Red/Code Blue Coverage"
              shifts={codeRedShifts}
              initialMode="month"
              emptyLabel="No Code Red/Code Blue shifts have been added for this date."
              codeRedStaffing
              compact
              headerAction={(
                <button
                  type="button"
                  onClick={() => setShowCodeRedShiftForm(true)}
                  className="word-button font-semibold"
                >
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                  Add Shifts
                </button>
              )}
            />
          ) : null}

          {!codeRedSupervisor || otherVisibleShifts.length > 0 ? (
            <CalendarBoard
              title="Team Schedule"
              shifts={codeRedSupervisor ? otherVisibleShifts : visibleAllShifts}
              timeOffRequests={visibleData.timeOffRequests}
              showByNameView
              initialMode="by-name"
              emptyLabel="No staffing shifts for this date."
              compact
              headerAction={role === "admin" ? (
                <button
                  type="button"
                  onClick={() => setShowOooForm(true)}
                  className="word-button font-semibold"
                >
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                  Add OOO
                </button>
              ) : null}
            />
          ) : null}

          {showCodeRedShiftForm ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-harbor-midnight/35 px-3 py-5 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="code-red-shifts-title"
            >
              <section className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg border border-white/70 bg-white p-4 shadow-soft sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-4 border-b border-harbor-ocean/10 pb-4">
                  <div>
                    <p className="label">Code Red/Code Blue Coverage</p>
                    <h2 id="code-red-shifts-title" className="mt-1 text-xl font-medium text-harbor-midnight">Add Shifts</h2>
                  </div>
                  <button type="button" onClick={() => setShowCodeRedShiftForm(false)} className="ghost-button px-1.5" aria-label="Close Add Shifts">
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <CodeRedShiftCreationForm />
              </section>
            </div>
          ) : null}

          {showOooForm ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-harbor-midnight/35 px-3 py-5 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-ooo-title"
            >
              <section className="w-full max-w-lg rounded-lg border border-white/70 bg-white p-4 shadow-soft sm:p-5">
                <div className="mb-4 flex items-start justify-between gap-4 border-b border-harbor-ocean/10 pb-4">
                  <div>
                    <p className="label">Team Schedule</p>
                    <h2 id="admin-ooo-title" className="mt-1 text-xl font-medium text-harbor-midnight">
                      Add OOO
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOooForm(false)}
                    className="ghost-button px-1.5"
                    aria-label="Close Add OOO"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <AdminOutOfOfficeForm />
              </section>
            </div>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-5">
          <section className="panel p-4">
            <p className="label">Shift Coverage Stats</p>
            <div className="mt-4 grid gap-3">
              <AdminMiniMetric label="Open shifts" value={visibleOpenShifts.length} />
              <AdminMiniMetric label="Covered shifts" value={visibleCoveredShifts.length} />
              <AdminMiniMetric
                label="Approved workers"
                value={
                  visibleData.workerProfiles.filter((profile) => profile.status === "approved").length
                }
              />
            </div>
          </section>

          {role === "admin" ? (
            <section className="panel p-4">
            <details>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span>
                  <span className="label block">Staff accounts</span>
                  <span className="mt-1 block text-lg font-medium text-harbor-midnight">
                    Create staff login
                  </span>
                </span>
                <span className="text-sm font-medium text-harbor-ocean">Open</span>
              </summary>
              <div className="mt-4 border-t border-harbor-ocean/10 pt-4">
                <StaffAccountInviteForm canInviteAdmin={canManageAccountTypes} />
              </div>
            </details>
            </section>
          ) : (
            <section className="panel p-4">
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span>
                    <span className="label block">Supervisor profile</span>
                    <span className="mt-1 block text-lg font-medium text-harbor-midnight">
                      Assigned programs and location
                    </span>
                  </span>
                  <span className="text-sm font-medium text-harbor-ocean">Open</span>
                </summary>
                <div className="mt-4 border-t border-harbor-ocean/10 pt-4">
                  <SupervisorProfileForm data={data} />
                </div>
              </details>
            </section>
          )}

          {showAdminModeration ? <AdminModeration data={visibleData} /> : null}
        </aside>
      </section>
    </DashboardShell>
  );
}

function AdminSnapshotCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-harbor-ocean/10 bg-harbor-mist/45 p-4">
      <p className="text-3xl font-semibold text-harbor-midnight">{value}</p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.11em] text-harbor-ocean">
        {label}
      </p>
    </div>
  );
}

function AdminMiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-harbor-ocean/10 bg-white p-3">
      <p className="text-2xl font-medium text-harbor-midnight">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.06em] text-harbor-midnight/55">
        {label}
      </p>
    </div>
  );
}

type AdminRequestTab = "new" | "pending" | "completed";
type CompletedRequestFilter = "all" | "approved" | "declined";

type AdminRequestItem =
  | { type: "shift"; created_at: string; status: ShiftRequest["status"]; request: ShiftRequest }
  | {
      type: "time-off";
      created_at: string;
      status: TimeOffRequest["status"];
      request: TimeOffRequest;
    };

function AdminRequestsWorkspace({
  data,
  role,
  viewedRequestKeys = new Set<string>(),
  onMarkReviewed = () => {},
  reviewError = null
}: {
  data: DashboardData;
  role: AppRole;
  viewedRequestKeys?: Set<string>;
  onMarkReviewed?: (kind: "shift" | "time-off", requestId: string) => void;
  reviewError?: string | null;
}) {
  const [activeTab, setActiveTab] = useState<AdminRequestTab>(
    [...data.requests.map((request) => ({ kind: "shift" as const, request })),
      ...data.timeOffRequests.map((request) => ({ kind: "time-off" as const, request }))]
      .some((item) => isNewPendingRequest(
        item.request,
        data.currentUser,
        viewedRequestKeys.has(requestViewKey(item.kind, item.request.id))
      ))
      ? "new"
      : "pending"
  );
  const [completedFilter, setCompletedFilter] = useState<CompletedRequestFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [notesRequest, setNotesRequest] = useState<AdminRequestItem | null>(null);
  const [notesByRequest, setNotesByRequest] = useState<Record<string, string>>({});
  const roleLabel = ROLE_LABELS[role];
  const shiftById = useMemo(
    () => new Map(data.shifts.map((shift) => [shift.id, shift])),
    [data.shifts]
  );

  const allRequests = useMemo<AdminRequestItem[]>(() => {
    return [
      ...data.requests.map((request) => ({
        type: "shift" as const,
        created_at: request.created_at,
        status: request.status,
        request
      })),
      ...data.timeOffRequests.map((request) => ({
        type: "time-off" as const,
        created_at: request.created_at,
        status: request.status,
        request
      }))
    ].sort((first, second) => second.created_at.localeCompare(first.created_at));
  }, [data.requests, data.timeOffRequests]);

  const isNew = (item: AdminRequestItem) => isNewPendingRequest(
    item,
    data.currentUser,
    viewedRequestKeys.has(requestViewKey(item.type, item.request.id))
  );
  const newRequests = allRequests.filter(isNew);
  const pending = allRequests.filter(
    (item) => item.status === "pending_supervisor_approval" && !isNew(item)
  );
  const completed = allRequests.filter(
    (item) => item.status === "approved" || item.status === "declined"
  );
  const completedVisible = completed.filter(
    (item) => completedFilter === "all" || item.status === completedFilter
  );
  const visibleRequests =
    activeTab === "new"
      ? newRequests
      : activeTab === "pending"
        ? pending
        : completedVisible;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const searchedRequests = visibleRequests.filter((item) => {
    if (!normalizedSearch) return true;

    if (item.type === "time-off") {
      const request = item.request;
      return [
        request.employee_name,
        request.program_name,
        request.start_date,
        request.end_date,
        request.reason,
        request.status
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    }

    const request = item.request;
    const shift = shiftById.get(request.shift_id);
    return [
      request.requestor_name,
      request.note,
      request.status,
      shift?.title,
      shift?.program_name,
      shift?.location_name,
      shift?.shift_date
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });

  return (
    <section className="panel p-3 sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="label">Request queue</p>
          <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
            {roleLabel} review workspace
          </h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <label className="min-w-0 sm:w-64">
            <span className="sr-only">Search requests</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="field"
              placeholder="Search requests"
            />
          </label>
          <RequestTabButton
            label="New"
            count={newRequests.length}
            active={activeTab === "new"}
            onClick={() => setActiveTab("new")}
          />
          <RequestTabButton
            label="Pending"
            count={pending.length}
            active={activeTab === "pending"}
            onClick={() => setActiveTab("pending")}
          />
          <RequestTabButton
            label="Completed"
            count={completed.length}
            active={activeTab === "completed"}
            onClick={() => setActiveTab("completed")}
          />
        </div>
      </div>

      {activeTab === "completed" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", "approved", "declined"] as CompletedRequestFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setCompletedFilter(filter)}
              className={completedFilter === filter ? "word-button font-semibold" : "word-button"}
            >
              {filter === "all" ? "All" : filter === "approved" ? "Approved" : "Declined"}
            </button>
          ))}
        </div>
      ) : null}

      {reviewError ? <p className="mt-4 text-sm text-red-700" role="alert">{reviewError}</p> : null}

      {searchedRequests.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-harbor-ocean/15 bg-white">
          <table className="w-full min-w-[950px] border-collapse text-left text-sm">
            <thead className="bg-harbor-mist text-xs font-semibold uppercase tracking-wide text-harbor-ocean">
              <tr>
                {[
                  "Employee", "Request", "Program", "Date / shift", "Submitted", "Status", "Decision", "Notes"
                ].map((heading) => <th key={heading} scope="col" className="px-4 py-3">{heading}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-harbor-ocean/10">
              {searchedRequests.map((item) => {
                const shift = item.type === "shift" ? shiftById.get(item.request.shift_id) : undefined;
                const key = requestViewKey(item.type, item.request.id);
                const pendingDecision = item.status === "pending_supervisor_approval";
                return (
                  <tr key={key} className="align-top hover:bg-harbor-mist/40">
                    <td className="px-4 py-4 font-medium text-harbor-midnight">
                      {item.type === "shift" ? item.request.requestor_name : item.request.employee_name}
                    </td>
                    <td className="px-4 py-4 text-harbor-midnight/80">{item.type === "shift" ? "Shift coverage" : "Time off"}</td>
                    <td className="px-4 py-4 text-harbor-midnight/80">{getProgramLabel(item.type === "shift" ? shift?.program_name ?? "" : item.request.program_name)}</td>
                    <td className="px-4 py-4 text-harbor-midnight/80">
                      {item.type === "shift" ? (
                        <><span className="font-medium">{shift?.title ?? "Shift"}</span><br />{shift ? formatLongDate(shift.shift_date) : "Date unavailable"}</>
                      ) : <>{formatLongDate(item.request.start_date)}<br />to {formatLongDate(item.request.end_date)}</>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-harbor-midnight/70">{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(item.created_at))}</td>
                    <td className="px-4 py-4"><RequestQueueStatus status={item.status} /></td>
                    <td className="px-4 py-4">
                      {pendingDecision ? <RequestDecisionControls item={item} role={role} reviewComment={notesByRequest[key] ?? ""} /> : <span className="text-harbor-midnight/50">Reviewed</span>}
                      {activeTab === "new" && pendingDecision ? <button type="button" onClick={() => onMarkReviewed(item.type, item.request.id)} className="mt-2 block text-xs font-medium text-harbor-ocean underline">Keep pending</button> : null}
                    </td>
                    <td className="px-4 py-4">
                      <button type="button" onClick={() => setNotesRequest(item)} className="rounded-lg border border-harbor-ocean/20 px-3 py-1.5 font-medium text-harbor-ocean hover:bg-harbor-mist" aria-label={`Open notes for ${item.type === "shift" ? item.request.requestor_name : item.request.employee_name}`}>
                        Notes{(notesByRequest[key] || item.request.review_comment) ? " •" : ""}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : normalizedSearch ? (
        <p className="mt-4 text-sm text-harbor-midnight/60" role="status">
          No requests match your search.
        </p>
      ) : null}
      {notesRequest ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-harbor-midnight/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setNotesRequest(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="request-notes-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><p className="label">Request notes</p><h3 id="request-notes-title" className="mt-1 text-xl font-semibold text-harbor-midnight">{notesRequest.type === "shift" ? notesRequest.request.requestor_name : notesRequest.request.employee_name}</h3></div>
              <button type="button" onClick={() => setNotesRequest(null)} aria-label="Close notes" className="rounded-lg p-2 text-harbor-midnight/60 hover:bg-harbor-mist"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-5 rounded-lg bg-harbor-mist p-4 text-sm text-harbor-midnight/80">
              <p className="font-semibold text-harbor-midnight">Employee request</p>
              <p className="mt-1 whitespace-pre-wrap">{notesRequest.type === "shift" ? notesRequest.request.note || "No note included." : notesRequest.request.reason}</p>
            </div>
            {notesRequest.status === "pending_supervisor_approval" ? (
              <label className="mt-5 block text-sm font-medium text-harbor-midnight">
                Comment for employee
                <textarea className="field mt-2 min-h-32" value={notesByRequest[requestViewKey(notesRequest.type, notesRequest.request.id)] ?? ""} onChange={(event) => setNotesByRequest((current) => ({ ...current, [requestViewKey(notesRequest.type, notesRequest.request.id)]: event.target.value }))} placeholder="Add the comment that will appear in the decision email." />
              </label>
            ) : <div className="mt-5 text-sm text-harbor-midnight"><p className="font-semibold">Decision comment</p><p className="mt-2 whitespace-pre-wrap">{notesRequest.request.review_comment || "No comment was added."}</p></div>}
            <div className="mt-5 flex justify-end"><button type="button" onClick={() => setNotesRequest(null)} className="primary-button">Done</button></div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RequestTabButton({
  label,
  count,
  active,
  onClick
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active ? "word-button font-semibold" : "word-button"}
    >
      {label}
      <span className="text-xs text-harbor-ocean/70">({count})</span>
    </button>
  );
}

function RequestQueueStatus({ status }: { status: ShiftRequest["status"] }) {
  const color = status === "approved"
    ? "border-green-200 bg-green-50 text-green-800"
    : status === "declined"
      ? "border-red-200 bg-red-50 text-red-800"
      : status === "pending_supervisor_approval"
        ? "border-orange-200 bg-orange-50 text-orange-800"
        : "border-slate-200 bg-slate-50 text-slate-700";
  const label = status === "pending_supervisor_approval"
    ? "Pending"
    : status === "declined"
      ? "Denied"
      : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${color}`}>{label}</span>;
}

function RequestDecisionControls({
  item,
  role,
  reviewComment
}: {
  item: AdminRequestItem;
  role: AppRole;
  reviewComment: string;
}) {
  const action = item.type === "shift" ? updateRequestStatusAction : updateTimeOffRequestStatusAction;
  const [approveState, approveAction] = useActionState(action, { ok: false, message: "" });
  const [denyState, denyAction] = useActionState(action, { ok: false, message: "" });
  return (
    <div className="min-w-36">
      <div className="flex flex-wrap gap-1.5">
        <form action={approveAction}>
          <input type="hidden" name="request_id" value={item.request.id} />
          {item.type === "shift" ? <input type="hidden" name="shift_id" value={item.request.shift_id} /> : null}
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="status" value="approved" />
          <input type="hidden" name="review_comment" value={reviewComment} />
          <SubmitButton className="!bg-green-700 !px-2.5 !py-1.5 !text-xs hover:!bg-green-800">Approve</SubmitButton>
        </form>
        <form action={denyAction}>
          <input type="hidden" name="request_id" value={item.request.id} />
          {item.type === "shift" ? <input type="hidden" name="shift_id" value={item.request.shift_id} /> : null}
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="status" value="declined" />
          <input type="hidden" name="review_comment" value={reviewComment} />
          <SubmitButton className="!bg-red-700 !px-2.5 !py-1.5 !text-xs hover:!bg-red-800">Deny</SubmitButton>
        </form>
      </div>
      <ActionFeedback state={approveState.message ? approveState : denyState} />
    </div>
  );
}

function AdminAnalyticsInset({ data }: { data: DashboardData }) {
  return (
    <div className="panel p-4 sm:p-5">
      <p className="label">Admin overview</p>
      <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
        Analytics snapshot
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Approved workers"
          value={data.analytics.approvedWorkers}
          icon={UsersRound}
        />
        <MetricCard
          label="This month requests"
          value={data.analytics.thisMonthRequests}
          icon={ClipboardList}
          tone="sky"
        />
        <MetricCard
          label="Pending time off"
          value={data.analytics.pendingTimeOffRequests}
          icon={CalendarX}
          tone="lemon"
        />
      </div>
    </div>
  );
}

type ProfileModerationItem =
  | { role: "employee"; profile: WorkerProfile }
  | { role: "supervisor"; profile: SupervisorProfile }
  | { role: "admin"; profile: AdminProfile };

function AdminModeration({ data }: { data: DashboardData }) {
  const currentAdminProfile = data.adminProfiles.find(
    (profile) => profile.user_id === data.currentUser.id
  );
  const canManageAdminScopes = currentAdminProfile?.is_super_admin === true;
  const pendingWorkers = data.workerProfiles.filter((profile) => profile.status === "pending");
  const pendingSupervisors = canManageAdminScopes
    ? data.supervisorProfiles.filter((profile) => profile.status === "pending")
    : [];
  const adminProfilesForReview = canManageAdminScopes
    ? data.adminProfiles.filter(
        (profile) =>
          profile.user_id !== data.currentUser.id &&
          (profile.status !== "pending" || profile.program_names.length > 0)
      )
    : [];
  const pendingProfiles: ProfileModerationItem[] = [
    ...pendingWorkers.map((profile) => ({ role: "employee" as const, profile })),
    ...pendingSupervisors.map((profile) => ({ role: "supervisor" as const, profile })),
    ...adminProfilesForReview.map((profile) => ({ role: "admin" as const, profile }))
  ];

  if (pendingProfiles.length === 0) return null;

  return (
    <section className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Profile moderation</p>
          <h2 className="mt-1 text-lg font-medium text-harbor-midnight">
            Profile reviews and access
          </h2>
        </div>
        <span className="rounded-full bg-harbor-mist px-2.5 py-1 text-xs font-medium text-harbor-ocean">
          {pendingProfiles.length}
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {pendingProfiles.map((item) => {
          const user = data.users.find((profileUser) => profileUser.id === item.profile.user_id);

          if (item.role === "employee") {
            return (
              <WorkerProfileReviewCard
                key={item.profile.id}
                profile={item.profile}
                user={user}
              />
            );
          }

          if (item.role === "supervisor") {
            return (
              <SupervisorProfileReviewCard
                key={item.profile.id}
                profile={item.profile}
                user={user}
              />
            );
          }

          return (
            <AdminProfileReviewCard
              key={item.profile.id}
              profile={item.profile}
              user={user}
            />
          );
        })}
      </div>
    </section>
  );
}

function AdminProfileReviewCard({
  profile,
  user
}: {
  profile: AdminProfile;
  user?: DashboardData["users"][number];
}) {
  const scopeLabel = profile.is_super_admin
    ? "Super admin"
    : profile.program_names.length > 0
      ? [...new Set(profile.program_names.map(getProgramLabel))].join(", ")
      : "No programs assigned";

  return (
    <details className="rounded-lg border border-harbor-ocean/10 bg-white p-3 shadow-line">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-harbor-midnight">
            {user?.full_name ?? "Admin profile"}
          </span>
          <span className="mt-1 block truncate text-xs text-harbor-midnight/50">
            {user?.email ?? "No email on file"}
          </span>
        </div>
        <StatusBadge value={profile.status} />
      </summary>

      <div className="mt-4 space-y-3 border-t border-harbor-ocean/10 pt-4">
        <ProfileDetail label="Role" value="Admin" />
        <ProfileDetail label="Access" value={scopeLabel} />
        <ProfileDetail label="Submitted" value={formatLongDate(profile.created_at.slice(0, 10))} />
        <ProfileModerationControls
          profileId={profile.id}
          profileRole="admin"
          adminProgramNames={profile.program_names}
          adminIsSuperAdmin={profile.is_super_admin}
        />
      </div>
    </details>
  );
}

function WorkerProfileReviewCard({
  profile,
  user
}: {
  profile: WorkerProfile;
  user?: DashboardData["users"][number];
}) {
  const programs = profile.program_names?.length ? profile.program_names : [profile.program_name];
  const preferredContact = profile.account_information?.preferredContact || "Not provided";

  return (
    <details className="rounded-lg border border-harbor-ocean/10 bg-white p-3 shadow-line">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          {profile.photo_url ? (
            <Image
              src={profile.photo_url}
              alt=""
              width={40}
              height={40}
              unoptimized
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-harbor-midnight text-xs font-medium text-white">
              {profileInitials(user?.full_name)}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-harbor-midnight">
              {user?.full_name ?? "New employee profile"}
            </span>
            <span className="mt-1 block truncate text-xs text-harbor-midnight/50">
              {user?.email ?? "No email on file"}
            </span>
          </span>
        </div>
        <StatusBadge value={profile.status} />
      </summary>

      <div className="mt-4 space-y-3 border-t border-harbor-ocean/10 pt-4">
        <ProfileDetail label="Role" value="Employee" />
        <ProfileDetail label="Phone" value={user?.phone || "Not provided"} />
        <ProfileDetail label="Preferred contact" value={preferredContact} />
        <ProfileDetail label="Programs" value={programs.join(", ")} />
        <ProfileDetail
          label="Regular work schedule"
          value={profile.availability.length > 0 ? profile.availability.join(", ") : "Not provided"}
        />
        <ProfileDetail
          label="Skills"
          value={profile.skills.length > 0 ? profile.skills.join(", ") : "Not provided"}
        />
        <ProfileDetail label="Submitted" value={formatLongDate(profile.created_at.slice(0, 10))} />
        <ProfileModerationControls profileId={profile.id} profileRole="employee" />
      </div>
    </details>
  );
}

function SupervisorProfileReviewCard({
  profile,
  user
}: {
  profile: SupervisorProfile;
  user?: DashboardData["users"][number];
}) {
  return (
    <details className="rounded-lg border border-harbor-ocean/10 bg-white p-3 shadow-line">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium text-harbor-midnight">
            {user?.full_name ?? "New supervisor profile"}
          </span>
          <span className="mt-1 block truncate text-xs text-harbor-midnight/50">
            {user?.email ?? "No email on file"}
          </span>
        </div>
        <StatusBadge value={profile.status} />
      </summary>

      <div className="mt-4 space-y-3 border-t border-harbor-ocean/10 pt-4">
        <ProfileDetail label="Role" value="Supervisor" />
        <ProfileDetail label="Phone" value={user?.phone || "Not provided"} />
        <ProfileDetail label="Title" value={profile.title || "Not provided"} />
        <ProfileDetail
          label="Assigned programs"
          value={
            profile.program_names.length > 0
              ? [...new Set(profile.program_names.map(getProgramLabel))].join(", ")
              : "No programs assigned"
          }
        />
        <ProfileDetail
          label="Program location profile"
          value={profile.front_desk_location_name || "Not provided"}
        />
        <ProfileDetail label="Location" value={profile.location_name || "Not provided"} />
        <ProfileDetail label="Submitted" value={formatLongDate(profile.created_at.slice(0, 10))} />
        <ProfileModerationControls
          profileId={profile.id}
          profileRole="supervisor"
          adminProgramNames={profile.program_names}
        />
      </div>
    </details>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-harbor-mist/70 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-harbor-ocean">
        {label}
      </p>
      <p className="mt-1 text-sm leading-5 text-harbor-midnight/75">{value}</p>
    </div>
  );
}

function profileInitials(name?: string) {
  return (name ?? "BH")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
