import { MailPlus, UsersRound } from "lucide-react";
import { DashboardShell } from "@/shared/components/DashboardShell";
import { EmptyState } from "@/shared/components/EmptyState";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { PROGRAMS, getProfileProgramNames, getProgramLabel } from "@/shared/lib/constants";
import { formatShortDate } from "@/shared/lib/dates";
import { hasSuperAdminAccess } from "@/shared/lib/access";
import { EmployeeAccountInviteForm } from "@/features/employees/components/EmployeeAccountInviteForm";
import { EmployeeProfileApprovalControls } from "@/features/employees/components/EmployeeProfileApprovalControls";
import { ProfileModerationControls } from "@/features/admin/components/ProfileModerationControls";
import { ProgramAssignmentControls } from "@/features/employees/components/ProgramAssignmentControls";
import type { AdminProfile, AppUser, DashboardData, ProgramName, SupervisorProfile, WorkerProfile } from "@/shared/types/domain";

type EmployeeRecord = {
  user: AppUser;
  profile?: WorkerProfile | SupervisorProfile | AdminProfile;
  workerProfile?: WorkerProfile;
  supervisorProfile?: SupervisorProfile;
  adminProfile?: AdminProfile;
};

function employeeRecords(data: DashboardData): EmployeeRecord[] {
  const canSeeAllRoles = hasSuperAdminAccess(data);
  return data.users
    .filter((user) => canSeeAllRoles || user.role === "employee")
    .map((user) => ({
      user,
      workerProfile: data.workerProfiles.find((profile) => profile.user_id === user.id),
      supervisorProfile: data.supervisorProfiles.find((profile) => profile.user_id === user.id),
      adminProfile: data.adminProfiles.find((profile) => profile.user_id === user.id)
    }))
    .map((record) => ({
      ...record,
      profile: record.user.role === "admin"
        ? record.adminProfile
        : record.user.role === "supervisor"
          ? record.supervisorProfile
          : record.workerProfile
    }))
    .sort((first, second) => first.user.full_name.localeCompare(second.user.full_name));
}

function programNamesForRecord(record: EmployeeRecord) {
  if (record.user.role === "admin") {
    return record.adminProfile?.program_names ?? [];
  }
  if (record.user.role === "supervisor") {
    return record.supervisorProfile?.program_names ?? [];
  }
  return getProfileProgramNames(record.workerProfile);
}

function programText(record: EmployeeRecord) {
  if (record.adminProfile?.is_super_admin) {
    return "All programs";
  }
  const programNames = programNamesForRecord(record);
  return programNames.length
    ? [...new Set(programNames.map(getProgramLabel))].join(", ")
    : "No programs selected";
}

function listText(items?: string[]) {
  return items?.length ? items.join(", ") : "Not provided";
}

function formatLastLogin(value?: string | null) {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit"
  }).format(date);
}

export function AdminEmployeesDashboard({ data }: { data: DashboardData }) {
  const employees = employeeRecords(data);
  const canManageReviewers = hasSuperAdminAccess(data);
  const currentAdminProfile = data.adminProfiles.find(
    (profile) => profile.user_id === data.currentUser.id
  );
  const currentSupervisorProfile = data.supervisorProfiles.find(
    (profile) => profile.user_id === data.currentUser.id
  );
  const isSupervisorView = data.currentUser.role === "supervisor";
  const inviteProgramNames = hasSuperAdminAccess(data)
    ? PROGRAMS
    : (currentAdminProfile?.program_names ?? currentSupervisorProfile?.program_names ?? []);
  const canEditPrograms = !isSupervisorView;
  const approvedProfiles = employees.filter((employee) => employee.profile?.status === "approved");
  const pendingProfiles = employees.filter((employee) => employee.profile?.status === "pending");
  const missingProfiles = employees.filter((employee) => !employee.profile);

  return (
    <DashboardShell role={isSupervisorView ? "supervisor" : "admin"} data={data}>
      <section className="rounded-lg border border-harbor-ocean/10 bg-white/95 p-3 shadow-soft sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label text-harbor-sky">
              {isSupervisorView ? "Supervisor" : "Admin"}
            </p>
            <h1 className="mt-2 text-3xl font-medium leading-tight text-harbor-midnight sm:text-4xl">
              Employees
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-harbor-midnight/62">
              {isSupervisorView
                ? "Supervisors can see and approve employee profiles in their assigned programs."
                : "Super admins can see and review every staff account type. Program admin approvals are limited to their assigned programs."}
            </p>
          </div>
          <span className="pill w-fit">{employees.length} staff accounts</span>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <EmployeeMetric label="Staff accounts" value={employees.length} />
          <EmployeeMetric label="Approved profiles" value={approvedProfiles.length} />
          <EmployeeMetric label="Pending profiles" value={pendingProfiles.length} />
          <EmployeeMetric label="Profiles needed" value={missingProfiles.length} />
        </div>
      </section>

      {!isSupervisorView ? (
        <section className="panel mt-4 p-3 sm:p-4">
        <details>
          <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <span className="label block">Create employee</span>
              <span className="mt-1 block text-xl font-medium text-harbor-midnight">
                Invite employee to complete profile
              </span>
            </span>
            <span className="word-button self-start font-semibold sm:self-auto">
              <MailPlus className="h-4 w-4" aria-hidden="true" />
              Open
            </span>
          </summary>
          <div className="mt-4 border-t border-harbor-ocean/10 pt-4">
            <EmployeeAccountInviteForm programNames={inviteProgramNames} />
          </div>
        </details>
        </section>
      ) : null}

      <section className="panel mt-4 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label">Staff list</p>
            <h2 className="mt-1 text-xl font-medium text-harbor-midnight">Accounts and profiles</h2>
          </div>
          <p className="text-xs text-harbor-midnight/55">
            {canManageReviewers
              ? "Showing all employees, supervisors, and admins."
              : isSupervisorView
                ? "Showing employees available to your supervisor access."
                : "Employee account actions are limited to your assigned programs."}
          </p>
        </div>

        <div className="mt-4">
          {employees.length > 0 ? (
            <EmployeeTable
              employees={employees}
              canEditPrograms={canEditPrograms}
              canManageReviewers={canManageReviewers}
              allowedProgramNames={canEditPrograms ? inviteProgramNames : []}
            />
          ) : (
            <EmptyState
              icon={UsersRound}
              title="No staff found"
              body="Staff accounts in your scope will appear here."
            />
          )}
        </div>
      </section>
    </DashboardShell>
  );
}

function EmployeeMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-harbor-ocean/12 bg-white p-3 shadow-line">
      <p className="text-2xl font-medium text-harbor-midnight">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.06em] text-harbor-midnight/58">
        {label}
      </p>
    </div>
  );
}

function EmployeeTable({
  employees,
  canEditPrograms,
  canManageReviewers,
  allowedProgramNames
}: {
  employees: EmployeeRecord[];
  canEditPrograms: boolean;
  canManageReviewers: boolean;
  allowedProgramNames: ProgramName[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-harbor-ocean/10 bg-white shadow-line">
      <table className="w-full min-w-[1560px] border-separate border-spacing-0 text-left text-sm">
        <thead className="bg-harbor-mist text-[11px] font-medium uppercase tracking-[0.06em] text-harbor-ocean">
          <tr>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Employee</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Account type</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Email</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Phone</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Programs</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Regular schedule</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Skills</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Created</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Last login</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Status</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Approval</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <EmployeeRow
              key={employee.user.id}
              employee={employee}
              canEditPrograms={canEditPrograms}
              canManageReviewers={canManageReviewers}
              allowedProgramNames={allowedProgramNames}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeRow({
  employee,
  canEditPrograms,
  canManageReviewers,
  allowedProgramNames
}: {
  employee: EmployeeRecord;
  canEditPrograms: boolean;
  canManageReviewers: boolean;
  allowedProgramNames: ProgramName[];
}) {
  const { user, profile, workerProfile, adminProfile } = employee;
  const reviewerProfile = user.role === "admin" || user.role === "supervisor";
  const canEditThisPrograms = canEditPrograms && !adminProfile?.is_super_admin;

  return (
    <tr className="align-top transition hover:bg-harbor-mist/45">
      <td className="border-b border-harbor-ocean/10 px-3 py-2.5 font-medium text-harbor-midnight">
        {user.full_name}
      </td>
      <td className="border-b border-harbor-ocean/10 px-3 py-2.5 font-medium capitalize text-harbor-midnight/70">
        {adminProfile?.is_super_admin ? "Super admin" : user.role}
      </td>
      <td className="border-b border-harbor-ocean/10 px-3 py-2.5 text-harbor-midnight/70">
        {user.email}
      </td>
      <td className="border-b border-harbor-ocean/10 px-3 py-2.5 text-harbor-midnight/70">
        {user.phone || "Not provided"}
      </td>
      <td className="max-w-[26rem] border-b border-harbor-ocean/10 px-3 py-2.5 text-xs leading-5 text-harbor-midnight/70">
        {programText(employee)}
        {canEditThisPrograms ? (
          <ProgramAssignmentControls
            userId={user.id}
            programNames={programNamesForRecord(employee)}
            allowedProgramNames={allowedProgramNames}
          />
        ) : null}
      </td>
      <EmployeeCell value={user.role === "employee" ? listText(workerProfile?.availability) : "—"} />
      <EmployeeCell value={user.role === "employee" ? listText(workerProfile?.skills) : "—"} />
      <td className="border-b border-harbor-ocean/10 px-3 py-2.5 text-harbor-midnight/70">
        {formatShortDate(user.created_at.slice(0, 10))}
      </td>
      <td className="border-b border-harbor-ocean/10 px-3 py-2.5 text-harbor-midnight/70">
        {formatLastLogin(user.last_sign_in_at ?? profile?.last_sign_in_at)}
      </td>
      <td className="border-b border-harbor-ocean/10 px-3 py-2.5">
        {profile ? (
          <StatusBadge value={profile.status} />
        ) : (
          <span className="rounded-full border border-harbor-ocean/10 bg-harbor-mist px-2 py-0.5 text-xs font-medium text-harbor-ocean">
            Profile needed
          </span>
        )}
      </td>
      <td className="border-b border-harbor-ocean/10 px-3 py-2.5">
        {reviewerProfile ? (
          canManageReviewers && profile && profile.status === "pending" ? (
            <details className="min-w-[17rem] rounded-md border border-harbor-ocean/10 bg-harbor-mist/35 px-2 py-1.5">
              <summary className="cursor-pointer text-xs font-semibold text-harbor-ocean">Review access</summary>
              <ProfileModerationControls
                profileId={profile.id}
                profileRole={user.role}
                adminProgramNames={programNamesForRecord(employee)}
                adminIsSuperAdmin={adminProfile?.is_super_admin}
                approveLabel="Approve access"
                suspendLabel="Deny access"
              />
            </details>
          ) : (
            <span className="text-xs text-harbor-midnight/45">
              {profile
                ? profile.status === "pending"
                  ? "Super admin review"
                  : profile.status === "suspended"
                    ? "Access suspended"
                    : "Approved"
                : "Awaiting profile"}
            </span>
          )
        ) : (
          <EmployeeProfileApprovalControls profile={workerProfile} />
        )}
      </td>
    </tr>
  );
}

function EmployeeCell({ value }: { value: string }) {
  return (
    <td className="max-w-[18rem] border-b border-harbor-ocean/10 px-3 py-2.5 text-xs leading-5 text-harbor-midnight/70">
      {value}
    </td>
  );
}
