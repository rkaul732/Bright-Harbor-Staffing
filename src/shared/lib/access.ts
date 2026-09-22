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
