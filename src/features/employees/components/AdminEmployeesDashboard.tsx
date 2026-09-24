import { MailPlus, UsersRound } from "lucide-react";
import { DashboardShell } from "@/shared/components/DashboardShell";
import { EmptyState } from "@/shared/components/EmptyState";
import { StatusBadge } from "@/shared/components/StatusBadge";
import { PROGRAMS, getProfileProgramNames } from "@/shared/lib/constants";
import { formatShortDate } from "@/shared/lib/dates";
import { hasSuperAdminAccess } from "@/shared/lib/access";
import { EmployeeAccountInviteForm } from "@/features/employees/components/EmployeeAccountInviteForm";
import type { AppUser, DashboardData, WorkerProfile } from "@/shared/types/domain";

type EmployeeRecord = {
  user: AppUser;
  profile?: WorkerProfile;
};

function employeeRecords(data: DashboardData): EmployeeRecord[] {
  return data.users
    .filter((user) => user.role === "employee")
    .map((user) => ({
      user,
      profile: data.workerProfiles.find((profile) => profile.user_id === user.id)
    }))
    .sort((first, second) => first.user.full_name.localeCompare(second.user.full_name));
}

function programText(profile?: WorkerProfile) {
  const programNames = getProfileProgramNames(profile);
  return programNames.length ? programNames.join(", ") : "No programs selected";
}

function listText(items?: string[]) {
  return items?.length ? items.join(", ") : "Not provided";
}

export function AdminEmployeesDashboard({ data }: { data: DashboardData }) {
  const employees = employeeRecords(data);
  const currentAdminProfile = data.adminProfiles.find(
    (profile) => profile.user_id === data.currentUser.id
  );
  const inviteProgramNames = hasSuperAdminAccess(data)
    ? PROGRAMS
    : (currentAdminProfile?.program_names ?? []);
  const approvedProfiles = employees.filter((employee) => employee.profile?.status === "approved");
  const pendingProfiles = employees.filter((employee) => employee.profile?.status === "pending");
  const missingProfiles = employees.filter((employee) => !employee.profile);

  return (
    <DashboardShell role="admin" data={data}>
      <section className="rounded-lg border border-harbor-ocean/10 bg-white/95 p-3 shadow-soft sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label text-harbor-sky">Admin</p>
            <h1 className="mt-2 text-3xl font-medium leading-tight text-harbor-midnight sm:text-4xl">
              Employees
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-harbor-midnight/62">
              Super admins can see all employee accounts. Program admins see employees in their assigned programs.
            </p>
          </div>
          <span className="pill w-fit">{employees.length} employee accounts</span>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <EmployeeMetric label="Employee accounts" value={employees.length} />
          <EmployeeMetric label="Approved profiles" value={approvedProfiles.length} />
          <EmployeeMetric label="Pending profiles" value={pendingProfiles.length} />
          <EmployeeMetric label="Profiles needed" value={missingProfiles.length} />
        </div>
      </section>

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

      <section className="panel mt-4 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label">Employee list</p>
            <h2 className="mt-1 text-xl font-medium text-harbor-midnight">Accounts and profiles</h2>
          </div>
          <p className="text-xs text-harbor-midnight/55">
            Showing only employees available to your admin access.
          </p>
        </div>

        <div className="mt-4">
          {employees.length > 0 ? (
            <EmployeeTable employees={employees} />
          ) : (
            <EmptyState
              icon={UsersRound}
              title="No employees found"
              body="Employee accounts in your admin scope will appear here."
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

function EmployeeTable({ employees }: { employees: EmployeeRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-harbor-ocean/10 bg-white shadow-line">
      <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-left text-sm">
        <thead className="bg-harbor-mist text-[11px] font-medium uppercase tracking-[0.06em] text-harbor-ocean">
          <tr>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Employee</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Email</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Phone</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Status</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Programs</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Regular schedule</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Skills</th>
            <th className="border-b border-harbor-ocean/10 px-3 py-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <EmployeeRow key={employee.user.id} employee={employee} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeRow({ employee }: { employee: EmployeeRecord }) {
  const { user, profile } = employee;

  return (
    <tr className="align-top transition hover:bg-harbor-mist/45">
      <td className="border-b border-harbor-ocean/10 px-3 py-2.5 font-medium text-harbor-midnight">
        {user.full_name}
      </td>
      <td className="border-b border-harbor-ocean/10 px-3 py-2.5 text-harbor-midnight/70">
        {user.email}
      </td>
      <td className="border-b border-harbor-ocean/10 px-3 py-2.5 text-harbor-midnight/70">
        {user.phone || "Not provided"}
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
      <EmployeeCell value={programText(profile)} />
      <EmployeeCell value={listText(profile?.availability)} />
      <EmployeeCell value={listText(profile?.skills)} />
      <td className="border-b border-harbor-ocean/10 px-3 py-2.5 text-harbor-midnight/70">
        {formatShortDate(user.created_at.slice(0, 10))}
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
