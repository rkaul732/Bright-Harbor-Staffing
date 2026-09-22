import { redirect } from "next/navigation";
import { AdminReportsDashboard } from "@/features/reports/components/AdminReportsDashboard";
import { hasAdminAccess } from "@/shared/lib/access";
import { getDashboardData } from "@/shared/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const data = await getDashboardData("admin");

  if (!hasAdminAccess(data)) {
    redirect("/employee");
  }

  return <AdminReportsDashboard data={data} />;
}
