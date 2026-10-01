import type { DashboardData } from "@/shared/types/domain";

export function hasAdminAccess(data: DashboardData) {
  return (
    data.currentUser.role === "admin" ||
    data.adminProfiles.some(
      (profile) =>
        profile.user_id === data.currentUser.id && profile.status === "approved"
    )
  );
}

export function hasSupervisorAccess(data: DashboardData) {
  return (
    data.currentUser.role === "supervisor" &&
    data.supervisorProfiles.some(
      (profile) =>
        profile.user_id === data.currentUser.id &&
        profile.status === "approved" &&
        profile.program_names.length > 0
    )
  );
}

export function hasSuperAdminAccess(data: DashboardData) {
  return data.adminProfiles.some(
    (profile) =>
      profile.user_id === data.currentUser.id &&
      profile.status === "approved" &&
      profile.is_super_admin === true
  );
}
