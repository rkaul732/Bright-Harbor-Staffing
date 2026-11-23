import { getRelatedProgramNames, normalizeAssignedProgramNames } from "@/shared/lib/constants";
import type { AppUser, DashboardData, ProgramName } from "@/shared/types/domain";

export type TeamMember = {
  user: AppUser;
  sharedPrograms: ProgramName[];
};

export function getMyTeam(data: DashboardData): TeamMember[] {
  const isAdmin = data.currentUser.role === "admin";
  const viewerProfile = isAdmin
    ? data.adminProfiles.find((profile) => profile.user_id === data.currentUser.id && profile.status === "approved")
    : data.supervisorProfiles.find((profile) => profile.user_id === data.currentUser.id && profile.status === "approved");

  if (!viewerProfile) return [];

  const allPrograms = isAdmin && data.adminProfiles.some((profile) =>
    profile.user_id === data.currentUser.id && profile.status === "approved" && profile.is_super_admin
  );
  const viewerPrograms = new Set(
    normalizeAssignedProgramNames(viewerProfile.program_names).flatMap(getRelatedProgramNames)
  );

  return data.users.flatMap((user) => {
    if (user.id === data.currentUser.id || user.role !== (isAdmin ? "supervisor" : "employee")) {
      return [];
    }

    const memberProfile = isAdmin
      ? data.supervisorProfiles.find((profile) => profile.user_id === user.id && profile.status === "approved")
      : data.workerProfiles.find((profile) => profile.user_id === user.id && profile.status !== "suspended");
    if (!memberProfile) return [];

    const memberPrograms = isAdmin
      ? memberProfile.program_names
      : "approved_program_names" in memberProfile ? memberProfile.approved_program_names : [];
    const sharedPrograms = normalizeAssignedProgramNames(memberPrograms).filter(
      (programName) => allPrograms || viewerPrograms.has(programName)
    );

    return sharedPrograms.length ? [{ user, sharedPrograms }] : [];
  }).sort((first, second) => first.user.full_name.localeCompare(second.user.full_name));
}
