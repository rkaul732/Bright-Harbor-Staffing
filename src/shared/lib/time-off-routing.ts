import { normalizeAssignedProgramNames } from "@/shared/lib/constants";
import type { DashboardData, ProgramName } from "@/shared/types/domain";

export function timeOffReviewerIds(
  data: Pick<DashboardData, "users" | "supervisorProfiles" | "adminProfiles">,
  requesterId: string,
  programName: ProgramName
) {
  const requester = data.users.find((user) => user.id === requesterId);
  const requesterIsSuperAdmin = data.adminProfiles.some(
    (profile) => profile.user_id === requesterId && profile.status === "approved" && profile.is_super_admin
  );
  const requesterIsSupervisor = requester?.role === "supervisor" ||
    (requester?.role === "admin" && !requesterIsSuperAdmin && data.supervisorProfiles.some(
      (profile) => profile.user_id === requesterId && profile.status === "approved"
    ));
  const requesterRole = requesterIsSupervisor ? "supervisor" : requester?.role ?? "employee";

  const ranked = data.users.flatMap((user) => {
    if (user.id === requesterId || !/^[^@\s]+@brightharbor\.org$/i.test(user.email)) return [];

    const supervisor = data.supervisorProfiles.find(
      (profile) => profile.user_id === user.id && profile.status === "approved"
    );
    const admin = data.adminProfiles.find(
      (profile) => profile.user_id === user.id && profile.status === "approved"
    );
    const assignedSupervisor = !!supervisor &&
      normalizeAssignedProgramNames(supervisor.program_names).includes(programName);
    const assignedAdmin = !!admin &&
      normalizeAssignedProgramNames(admin.program_names).includes(programName);
    const superAdmin = !!admin?.is_super_admin;

    let priority = 99;
    if (requesterRole === "admin") {
      if (user.role === "admin" && superAdmin) priority = 1;
    } else if (requesterRole === "supervisor") {
      if (user.role === "admin" && assignedAdmin) priority = 1;
      else if (user.role === "admin" && superAdmin) priority = 2;
    } else if (user.role === "supervisor" && assignedSupervisor) {
      priority = 1;
    } else if (user.role === "admin" && assignedSupervisor) {
      priority = 2;
    } else if (user.role === "admin" && assignedAdmin) {
      priority = 3;
    } else if (user.role === "admin" && superAdmin) {
      priority = 4;
    }

    return priority < 99 ? [{ userId: user.id, priority }] : [];
  });

  const topPriority = Math.min(...ranked.map((candidate) => candidate.priority));
  return ranked.filter((candidate) => candidate.priority === topPriority)
    .map((candidate) => candidate.userId);
}
