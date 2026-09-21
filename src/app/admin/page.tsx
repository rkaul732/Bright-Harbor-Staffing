import { SupervisorDashboard } from "@/features/dashboard/components/SupervisorDashboard";
import { getDashboardData } from "@/shared/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const data = await getDashboardData("admin");
  return <SupervisorDashboard data={data} role="admin" showAdminModeration />;
}
