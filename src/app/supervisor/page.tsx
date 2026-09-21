import { SupervisorDashboard } from "@/features/dashboard/components/SupervisorDashboard";
import { getDashboardData } from "@/shared/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function SupervisorPage() {
  const data = await getDashboardData("supervisor");
  return <SupervisorDashboard data={data} />;
}
