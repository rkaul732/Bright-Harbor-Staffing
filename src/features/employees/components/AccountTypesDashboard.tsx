import { MailPlus, ShieldCheck } from "lucide-react";
import { AccountTypeControls } from "@/features/employees/components/AccountTypeControls";
import { DeleteEmployeeControl } from "@/features/employees/components/DeleteEmployeeControl";
import { StaffAccountInviteForm } from "@/features/admin/components/StaffAccountInviteForm";
import { ProgramAssignmentControls } from "@/features/employees/components/ProgramAssignmentControls";
import { DashboardShell } from "@/shared/components/DashboardShell";
import { EmptyState } from "@/shared/components/EmptyState";
import { PROGRAMS, getProfileProgramNames, getProgramLabel, normalizeAssignedProgramNames } from "@/shared/lib/constants";
import type {
  AdminProfile,
  AppUser,
  DashboardData,
  ProgramName,
  SupervisorProfile,
  WorkerProfile
} from "@/shared/types/domain";

function userWorkerProfile(user: AppUser, profiles: WorkerProfile[]) {
  return profiles.find((profile) => profile.user_id === user.id);
}

function userSupervisorProfile(user: AppUser, profiles: SupervisorProfile[]) {
  return profiles.find((profile) => profile.user_id === user.id);
}

function userAdminProfile(user: AppUser, profiles: AdminProfile[]) {
  return profiles.find((profile) => profile.user_id === user.id);
}

function programNamesForUser(data: DashboardData, user: AppUser) {
  const workerProfile = userWorkerProfile(user, data.workerProfiles);
  const supervisorProfile = userSupervisorProfile(user, data.supervisorProfiles);
  const adminProfile = userAdminProfile(user, data.adminProfiles);

  if (adminProfile?.is_super_admin) {
    return [] as ProgramName[];
  }

  if (user.role === "supervisor" && supervisorProfile?.program_names.length) {
    return normalizeAssignedProgramNames(supervisorProfile.program_names);
  }

  if (user.role === "admin" && adminProfile?.program_names.length) {
    return normalizeAssignedProgramNames(adminProfile.program_names);
  }

  const workerProgramNames = getProfileProgramNames(workerProfile);

  if (workerProgramNames.length) {
    return workerProgramNames;
  }

  if (supervisorProfile?.program_names.length) {
    return normalizeAssignedProgramNames(supervisorProfile.program_names);
  }

  return normalizeAssignedProgramNames(adminProfile?.program_names ?? []);
}

function programText(programNames: ProgramName[], isSuperAdmin: boolean) {
  if (isSuperAdmin) {
    return "All programs";
  }

  return programNames.length
    ? [...new Set(programNames.map(getProgramLabel))].join(", ")
    : "No programs assigned";
}

function formatAccountChange(value?: string | null) {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York"
  }).format(date);
}

export function AccountTypesDashboard({ data }: { data: DashboardData }) {
  const users = [...data.users].sort((first, second) =>
    first.full_name.localeCompare(second.full_name)
  );

  return (
    <DashboardShell role="admin" data={data}>
      <section className="rounded-lg border border-harbor-ocean/10 bg-white/95 p-3 shadow-soft sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label text-harbor-sky">Super Admin</p>
            <h1 className="mt-2 text-3xl font-medium leading-tight text-harbor-midnight sm:text-4xl">
              Account Types
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-harbor-midnight/62">
              Select a staff member’s account type to update their access, or delete an employee account.
            </p>
          </div>
          <span className="pill w-fit">{users.length} accounts</span>
        </div>
      </section>

      <section className="panel mt-4 p-3 sm:p-4">
        <details>
          <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <span className="label block">Staff accounts</span>
              <span className="mt-1 block text-xl font-medium text-harbor-midnight">Create an account for someone</span>
              <span className="mt-1 block text-sm leading-6 text-harbor-midnight/65">
                Enter their Bright Harbor email, account type, and programs. They’ll receive a secure link to set their own password.
              </span>
            </span>
            <span className="word-button w-fit shrink-0 font-semibold">
              <MailPlus className="h-4 w-4" aria-hidden="true" />
              Create account
            </span>
          </summary>
          <div className="mt-4 max-w-2xl border-t border-harbor-ocean/10 pt-4">
            <StaffAccountInviteForm canInviteAdmin />
          </div>
        </details>
      </section>

      <section className="panel mt-4 p-3 sm:p-4">
        {users.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-harbor-ocean/10 bg-white shadow-line">
            <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-harbor-mist text-[11px] font-medium uppercase tracking-[0.06em] text-harbor-ocean">
                <tr>
                  <th className="border-b border-harbor-ocean/10 px-3 py-2">Employee name</th>
                  <th className="border-b border-harbor-ocean/10 px-3 py-2">Programs</th>
                  <th className="border-b border-harbor-ocean/10 px-3 py-2">Last account change</th>
                  <th className="border-b border-harbor-ocean/10 px-3 py-2">Account type</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const adminProfile = userAdminProfile(user, data.adminProfiles);
                  const isSuperAdmin = adminProfile?.is_super_admin === true;
                  const programNames = programNamesForUser(data, user);

                  return (
                    <tr key={user.id} className="align-top transition hover:bg-harbor-mist/45">
                      <td className="border-b border-harbor-ocean/10 px-3 py-2.5 font-medium text-harbor-midnight">
                        {user.full_name}
                        {user.role === "employee" ? (
                          <DeleteEmployeeControl userId={user.id} name={user.full_name} email={user.email} />
                        ) : null}
                      </td>
                      <td className="max-w-[26rem] border-b border-harbor-ocean/10 px-3 py-2.5 text-xs leading-5 text-harbor-midnight/70">
                        {programText(programNames, isSuperAdmin)}
                        {user.role === "employee" && !isSuperAdmin ? (
                          <ProgramAssignmentControls
                            userId={user.id}
                            programNames={programNames}
                            allowedProgramNames={PROGRAMS}
                          />
                        ) : null}
                      </td>
                      <td className="border-b border-harbor-ocean/10 px-3 py-2.5 text-harbor-midnight/70">
                        {formatAccountChange(user.account_type_changed_at)}
                      </td>
                      <td className="border-b border-harbor-ocean/10 px-3 py-2.5">
                        {isSuperAdmin ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-harbor-sky/20 bg-harbor-mist px-2.5 py-1 text-xs font-medium text-harbor-ocean">
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            Super Admin
                          </span>
                        ) : (
                          <AccountTypeControls
                            userId={user.id}
                            currentRole={user.role}
                            programNames={programNames}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="No accounts found"
            body="Staff accounts will appear here after they are created."
          />
        )}
      </section>
    </DashboardShell>
  );
}
