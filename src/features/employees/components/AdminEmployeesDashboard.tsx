import { Mail, MailPlus, Phone, UsersRound } from "lucide-react";
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

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "BH";
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

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {employees.length > 0 ? (
            employees.map((employee) => <EmployeeCard key={employee.user.id} employee={employee} />)
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

function EmployeeCard({ employee }: { employee: EmployeeRecord }) {
  const { user, profile } = employee;

  return (
    <article className="min-w-0 rounded-lg border border-harbor-ocean/10 bg-white p-3 shadow-line">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-harbor-midnight text-xs font-medium text-white">
            {initials(user.full_name)}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-medium text-harbor-midnight">{user.full_name}</h3>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-harbor-midnight/58">
              <span className="inline-flex min-w-0 items-center gap-1">
                <Mail className="h-3.5 w-3.5 shrink-0 text-harbor-ocean" aria-hidden="true" />
                <span className="truncate">{user.email}</span>
              </span>
              {user.phone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5 text-harbor-ocean" aria-hidden="true" />
                  {user.phone}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {profile ? (
          <StatusBadge value={profile.status} />
        ) : (
          <span className="rounded-full border border-harbor-ocean/10 bg-harbor-mist px-2 py-0.5 text-xs font-medium text-harbor-ocean">
            Profile needed
          </span>
        )}
      </div>

      <dl className="mt-3 grid gap-2 text-xs text-harbor-midnight/68 sm:grid-cols-2">
        <EmployeeDetail label="Programs" value={programText(profile)} />
        <EmployeeDetail label="Regular schedule" value={listText(profile?.availability)} />
        <EmployeeDetail label="Skills" value={listText(profile?.skills)} />
        <EmployeeDetail label="Account created" value={formatShortDate(user.created_at.slice(0, 10))} />
      </dl>
    </article>
  );
}

function EmployeeDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-harbor-mist/70 px-2.5 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-harbor-ocean">
        {label}
      </dt>
      <dd className="mt-1 leading-5 text-harbor-midnight/72">{value}</dd>
    </div>
  );
}
