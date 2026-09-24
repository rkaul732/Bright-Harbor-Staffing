"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarCheck, CalendarClock, CalendarPlus, CalendarX, ClipboardList, UsersRound, X } from "lucide-react";
import { DashboardShell } from "@/shared/components/DashboardShell";
import { MetricCard } from "@/shared/components/MetricCard";
import { CalendarBoard } from "@/shared/components/CalendarBoard";
import { ShiftCard } from "@/shared/components/ShiftCard";
import { EmptyState } from "@/shared/components/EmptyState";
import { AdSlots } from "@/shared/components/AdSlots";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { SupervisorProfileForm } from "@/features/profiles/components/ProfileForms";
import { SupervisorShiftPostForm } from "@/features/shifts/components/ShiftPostForms";
import { AdminOutOfOfficeForm, TimeOffApprovalControls } from "@/features/time-off/components/TimeOffForms";
import {
  ApprovalControls,
  CancelShiftForm,
  MessageForm,
  RescheduleShiftForm
} from "@/features/shifts/components/ShiftActionForms";
import { ProfileModerationControls } from "@/features/admin/components/ProfileModerationControls";
import { StaffAccountInviteForm } from "@/features/admin/components/StaffAccountInviteForm";
import { formatLongDate, sortShifts } from "@/shared/lib/dates";
import type {
  AdminProfile,
  AppRole,
  DashboardData,
  ShiftPost,
  ShiftRequest,
  SupervisorProfile,
  TimeOffRequest,
  WorkerProfile
} from "@/shared/types/domain";

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

  if (role === "admin") {
    return (
      <AdminDashboardHome
        data={data}
        allShifts={allShifts}
        openShifts={openShifts}
        coveredShifts={coveredShifts}
        pendingTimeOffRequests={pendingTimeOffRequests}
        showAdminModeration={showAdminModeration}
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

            {role === "supervisor" ? (
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

          {(role as AppRole) === "admin" ? (
            <AdminRequestsWorkspace data={data} role={role} />
          ) : (
            <>
              <section className="panel p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="label">Review requests</p>
                    <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
                      Pending supervisor approval
                    </h2>
                  </div>
                  <p className="text-sm text-harbor-midnight/60">
                    Routed to bpataky@brightharbor.org
                  </p>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  {pendingRequests.length > 0 ? (
                    pendingRequests.map((request) => (
                      <RequestReviewCard
                        key={request.id}
                        request={request}
                        shift={data.shifts.find((shift) => shift.id === request.shift_id)}
                        role={role}
                      />
                    ))
                  ) : (
                    <EmptyState
                      icon={UsersRound}
                      title="No pending approvals"
                      body="New employee shift requests will appear here."
                    />
                  )}
                </div>
              </section>

              <section className="panel p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="label">Time off requests</p>
                    <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
                      Pending employee time off
                    </h2>
                  </div>
                  <p className="text-sm text-harbor-midnight/60">
                    {pendingTimeOffRequests.length} pending
                  </p>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  {pendingTimeOffRequests.length > 0 ? (
                    pendingTimeOffRequests.map((request) => (
                      <TimeOffReviewCard key={request.id} request={request} role={role} />
                    ))
                  ) : (
                    <EmptyState
                      icon={CalendarX}
                      title="No pending time off"
                      body="Employee time off requests will appear here."
                    />
                  )}
                </div>
              </section>
            </>
          )}

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
  allShifts,
  openShifts,
  coveredShifts,
  pendingTimeOffRequests,
  showAdminModeration
}: {
  data: DashboardData;
  allShifts: ShiftPost[];
  openShifts: ShiftPost[];
  coveredShifts: ShiftPost[];
  pendingTimeOffRequests: TimeOffRequest[];
  showAdminModeration: boolean;
}) {
  const lastSignOn = data.currentUser.last_sign_in_at ?? data.currentUser.created_at;
  const newTimeOffRequests = data.timeOffRequests.filter(
    (request) => request.created_at > lastSignOn
  );
  const approvedTimeOffRequests = data.timeOffRequests.filter(
    (request) => request.status === "approved"
  );
  const deniedTimeOffRequests = data.timeOffRequests.filter(
    (request) => request.status === "declined"
  );
  const totalAccounts = data.users.length;
  const [showOooForm, setShowOooForm] = useState(false);

  return (
    <DashboardShell role="admin" data={data}>
      <section className="rounded-lg border border-harbor-ocean/10 bg-white/95 p-3 shadow-soft sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="label text-harbor-sky">Admin Dashboard</p>
            <h2 className="mt-2 text-3xl font-medium leading-tight text-harbor-midnight sm:text-4xl">
              Welcome, {data.currentUser.full_name}!
            </h2>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.06em] text-harbor-ocean">
              Admin
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <Link href="/reports" className="word-button font-semibold">
              Reports
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <AdminSnapshotCard label="New since sign on" value={newTimeOffRequests.length} />
          <AdminSnapshotCard label="Still pending" value={pendingTimeOffRequests.length} />
          <AdminSnapshotCard label="Approved" value={approvedTimeOffRequests.length} />
          <AdminSnapshotCard label="Denied" value={deniedTimeOffRequests.length} />
        </div>

        <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))]">
          <AdminHubCard title="New Requests" badge={pendingTimeOffRequests.length + " waiting"} />
          <AdminHubCard title="Team Schedule" badge={approvedTimeOffRequests.length + " approved"} />
          <AdminHubCard title="Reports" badge="Spreadsheet export" href="/reports" />
          <AdminHubCard title="Account Types" badge={totalAccounts + " accounts"} />
        </div>
      </section>

      <section className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="min-w-0 space-y-5">
          <section className="panel p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="label">New Requests</p>
                <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
                  Time off requests
                </h2>
              </div>
              <p className="text-sm text-harbor-midnight/55">
                {pendingTimeOffRequests.length} still pending
              </p>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              {pendingTimeOffRequests.length > 0 ? (
                pendingTimeOffRequests.map((request) => (
                  <TimeOffReviewCard key={request.id} request={request} role="admin" />
                ))
              ) : (
                <EmptyState
                  icon={CalendarX}
                  title="No pending time off"
                  body="New employee time off requests will appear here."
                />
              )}
            </div>
          </section>

          <CalendarBoard
            title="Team Schedule"
            shifts={allShifts}
            timeOffRequests={data.timeOffRequests}
            showByNameView
            initialMode="by-name"
            emptyLabel="No staffing shifts for this date."
            headerAction={
              <button
                type="button"
                onClick={() => setShowOooForm(true)}
                className="word-button font-semibold"
              >
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                Add OOO
              </button>
            }
          />

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
            <p className="label">Staffing snapshot</p>
            <div className="mt-4 grid gap-3">
              <AdminMiniMetric label="Open shifts" value={openShifts.length} />
              <AdminMiniMetric label="Covered shifts" value={coveredShifts.length} />
              <AdminMiniMetric label="Approved workers" value={data.analytics.approvedWorkers} />
            </div>
          </section>

          <section className="panel p-4">
            <details>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span>
                  <span className="label block">Post available shifts</span>
                  <span className="mt-1 block text-lg font-medium text-harbor-midnight">
                    Add coverage need
                  </span>
                </span>
                <span className="text-sm font-medium text-harbor-ocean">Open</span>
              </summary>
              <div className="mt-4 border-t border-harbor-ocean/10 pt-4">
                <SupervisorShiftPostForm role="admin" />
              </div>
            </details>
          </section>

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
                <StaffAccountInviteForm />
              </div>
            </details>
          </section>

          {showAdminModeration ? <AdminModeration data={data} /> : null}
        </aside>
      </section>
    </DashboardShell>
  );
}

function AdminSnapshotCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-harbor-ocean/12 bg-white p-3 shadow-line">
      <p className="text-2xl font-medium text-harbor-midnight">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.06em] text-harbor-midnight/58">
        {label}
      </p>
    </div>
  );
}

function AdminHubCard({
  title,
  badge,
  href
}: {
  title: string;
  badge: string;
  href?: string;
}) {
  const content = (
    <>
      <h3 className="text-xl font-medium text-harbor-midnight">{title}</h3>
      <span className="mt-6 inline-flex w-fit rounded-full border border-harbor-sky/20 bg-harbor-mist px-2.5 py-1 text-xs font-medium text-harbor-ocean">
        {badge}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="min-w-0 rounded-lg border border-harbor-ocean/12 bg-white p-3 shadow-line transition hover:border-harbor-sky/35 hover:shadow-soft"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="min-w-0 rounded-lg border border-harbor-ocean/12 bg-white p-3 shadow-line">
      {content}
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

function AdminRequestsWorkspace({ data, role }: { data: DashboardData; role: AppRole }) {
  const [activeTab, setActiveTab] = useState<AdminRequestTab>("new");
  const [completedFilter, setCompletedFilter] = useState<CompletedRequestFilter>("all");

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

  const newCutoff = data.currentUser.last_sign_in_at ?? data.currentUser.created_at;
  const newRequests = allRequests.filter((item) => item.created_at > newCutoff);
  const pending = allRequests.filter(
    (item) => item.status === "pending_supervisor_approval"
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

  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="label">Requests</p>
          <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
            Admin request review
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
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

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {visibleRequests.length > 0 ? (
          visibleRequests.map((item) =>
            item.type === "shift" ? (
              <RequestReviewCard
                key={`shift-${item.request.id}`}
                request={item.request}
                shift={data.shifts.find((shift) => shift.id === item.request.shift_id)}
                role={role}
              />
            ) : (
              <TimeOffReviewCard
                key={`time-off-${item.request.id}`}
                request={item.request}
                role={role}
              />
            )
          )
        ) : (
          <EmptyState
            icon={UsersRound}
            title="No requests in this view"
            body="Use the request filters above to switch between new, pending, and completed requests."
          />
        )}
      </div>
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

function RequestReviewCard({
  request,
  shift,
  role
}: {
  request: ShiftRequest;
  shift?: ShiftPost;
  role: AppRole;
}) {
  const canReview = request.status === "pending_supervisor_approval";

  return (
    <article className="rounded-lg border border-harbor-ocean/10 bg-white p-4 shadow-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-harbor-midnight">
            {request.requestor_name}
          </h3>
          <p className="mt-1 text-sm text-harbor-midnight/60">
            {shift?.title ?? "Shift request"} at {shift?.location_name ?? "location pending"}
          </p>
        </div>
        <StatusBadge value={request.status} />
      </div>
      {request.note ? (
        <p className="mt-3 rounded-lg bg-harbor-mist p-3 text-sm leading-6 text-harbor-midnight/70">
          {request.note}
        </p>
      ) : null}
      {request.review_comment ? (
        <p className="mt-3 rounded-lg border border-harbor-ocean/10 bg-white p-3 text-sm leading-6 text-harbor-midnight/70">
          <span className="font-medium text-harbor-midnight">Review comment:</span>{" "}
          {request.review_comment}
        </p>
      ) : null}
      {canReview ? (
        <div className="mt-4 space-y-4">
          <ApprovalControls request={request} role={role} />
          <MessageForm request={request} role={role} />
        </div>
      ) : null}
    </article>
  );
}

function TimeOffReviewCard({
  request,
  role
}: {
  request: TimeOffRequest;
  role: AppRole;
}) {
  const canReview = request.status === "pending_supervisor_approval";

  return (
    <article className="rounded-lg border border-harbor-ocean/10 bg-white p-4 shadow-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium text-harbor-midnight">
            {request.employee_name}
          </h3>
          <p className="mt-1 text-sm text-harbor-midnight/60">
            {request.program_name} - {formatLongDate(request.start_date)} through{" "}
            {formatLongDate(request.end_date)}
          </p>
        </div>
        <StatusBadge value={request.status} />
      </div>
      <p className="mt-3 rounded-lg bg-harbor-mist p-3 text-sm leading-6 text-harbor-midnight/70">
        {request.reason}
      </p>
      {request.review_comment ? (
        <p className="mt-3 rounded-lg border border-harbor-ocean/10 bg-white p-3 text-sm leading-6 text-harbor-midnight/70">
          <span className="font-medium text-harbor-midnight">Review comment:</span>{" "}
          {request.review_comment}
        </p>
      ) : null}
      {canReview ? (
        <div className="mt-4">
          <TimeOffApprovalControls request={request} role={role} />
        </div>
      ) : null}
    </article>
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
  const pendingSupervisors = data.supervisorProfiles.filter(
    (profile) => profile.status === "pending"
  );
  const adminProfilesForReview = canManageAdminScopes
    ? data.adminProfiles.filter((profile) => profile.user_id !== data.currentUser.id)
    : [];
  const pendingProfiles: ProfileModerationItem[] = [
    ...pendingWorkers.map((profile) => ({ role: "employee" as const, profile })),
    ...pendingSupervisors.map((profile) => ({ role: "supervisor" as const, profile })),
    ...adminProfilesForReview.map((profile) => ({ role: "admin" as const, profile }))
  ];

  return (
    <section className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Profile moderation</p>
          <h2 className="mt-1 text-lg font-medium text-harbor-midnight">
            Pending profile reviews
          </h2>
        </div>
        <span className="rounded-full bg-harbor-mist px-2.5 py-1 text-xs font-medium text-harbor-ocean">
          {pendingProfiles.length}
        </span>
      </div>
      <div className="mt-3 space-y-3">
        {pendingProfiles.length > 0 ? (
          pendingProfiles.map((item) => {
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
          })
        ) : (
          <EmptyState
            icon={UsersRound}
            title="No pending profiles"
            body="Employee, supervisor, and admin reviews are clear."
          />
        )}
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
      ? profile.program_names.join(", ")
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
          label="Program location profile"
          value={profile.front_desk_location_name || "Not provided"}
        />
        <ProfileDetail label="Location" value={profile.location_name || "Not provided"} />
        <ProfileDetail label="Submitted" value={formatLongDate(profile.created_at.slice(0, 10))} />
        <ProfileModerationControls profileId={profile.id} profileRole="supervisor" />
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
