"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, CalendarClock, CalendarX, ClipboardList, UsersRound } from "lucide-react";
import { DashboardShell } from "@/shared/components/DashboardShell";
import { MetricCard } from "@/shared/components/MetricCard";
import { CalendarBoard } from "@/shared/components/CalendarBoard";
import { ShiftCard } from "@/shared/components/ShiftCard";
import { EmptyState } from "@/shared/components/EmptyState";
import { AdSlots } from "@/shared/components/AdSlots";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { SupervisorProfileForm } from "@/features/profiles/components/ProfileForms";
import { SupervisorShiftPostForm } from "@/features/shifts/components/ShiftPostForms";
import { TimeOffApprovalControls } from "@/features/time-off/components/TimeOffForms";
import {
  ApprovalControls,
  CancelShiftForm,
  MessageForm,
  RescheduleShiftForm
} from "@/features/shifts/components/ShiftActionForms";
import { ProfileModerationControls } from "@/features/admin/components/ProfileModerationControls";
import { formatLongDate, sortShifts } from "@/shared/lib/dates";
import type {
  AppRole,
  DashboardData,
  ShiftPost,
  ShiftRequest,
  TimeOffRequest
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

  return (
    <DashboardShell role={role} data={data}>
      <div className="grid gap-5 lg:grid-cols-[1fr_21rem]">
        <div className="min-w-0 space-y-5">
          {role === "admin" ? (
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
            timeOffRequests={role === "admin" ? data.timeOffRequests : undefined}
            showByNameView={role === "admin"}
          />

          <section className="grid gap-5 xl:grid-cols-2">
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

          {role === "admin" ? (
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

function AdminModeration({ data }: { data: DashboardData }) {
  const pendingWorkers = data.workerProfiles.filter((profile) => profile.status === "pending");
  const pendingSupervisors = data.supervisorProfiles.filter(
    (profile) => profile.status === "pending"
  );

  return (
    <section className="panel p-4">
      <p className="label">Profile moderation</p>
      <div className="mt-3 space-y-3">
        {[...pendingWorkers, ...pendingSupervisors].length > 0 ? (
          [...pendingWorkers, ...pendingSupervisors].map((profile) => {
            const user = data.users.find((item) => item.id === profile.user_id);
            return (
              <div
                key={profile.id}
                className="rounded-lg border border-harbor-ocean/10 bg-white p-3"
              >
                <p className="text-sm font-medium text-harbor-midnight">
                  {user?.full_name ?? "New profile"}
                </p>
                <p className="mt-1 text-xs text-harbor-midnight/50">{user?.email}</p>
                <StatusBadge value={profile.status} />
                <ProfileModerationControls
                  profileId={profile.id}
                  profileRole={pendingSupervisors.some((item) => item.id === profile.id) ? "supervisor" : "employee"}
                />
              </div>
            );
          })
        ) : (
          <EmptyState
            icon={UsersRound}
            title="No pending profiles"
            body="Worker and supervisor approvals are clear."
          />
        )}
      </div>
    </section>
  );
}
