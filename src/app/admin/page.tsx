import { redirect } from "next/navigation";
import { SupervisorDashboard } from "@/features/dashboard/components/SupervisorDashboard";
import { PendingAdminAccess } from "@/features/auth/components/PendingAdminAccess";
import { hasAdminAccess } from "@/shared/lib/access";
import { getDashboardData } from "@/shared/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const data = await getDashboardData("admin");

  if (!hasAdminAccess(data)) {
    if (data.currentUser.role === "admin") {
      const profile = data.adminProfiles.find((item) => item.user_id === data.currentUser.id);
      return <PendingAdminAccess suspended={profile?.status === "suspended"} />;
    }
    redirect("/employee");
  }

  return <SupervisorDashboard data={data} role="admin" showAdminModeration />;
}
