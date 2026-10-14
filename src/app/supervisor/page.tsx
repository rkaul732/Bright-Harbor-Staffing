import { redirect } from "next/navigation";
import { SupervisorDashboard } from "@/features/dashboard/components/SupervisorDashboard";
import { hasSupervisorAccess } from "@/shared/lib/access";
import { getDashboardData } from "@/shared/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function SupervisorPage() {
  const data = await getDashboardData("supervisor");

  if (!hasSupervisorAccess(data)) {
    redirect("/employee");
  }

  return <SupervisorDashboard data={data} />;
}
