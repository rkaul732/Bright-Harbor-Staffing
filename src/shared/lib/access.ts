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

export function hasSuperAdminAccess(data: DashboardData) {
  return data.adminProfiles.some(
    (profile) =>
      profile.user_id === data.currentUser.id &&
      profile.status === "approved" &&
      profile.is_super_admin === true
  );
}
