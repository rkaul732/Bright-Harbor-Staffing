import { EmployeeDashboard } from "@/features/dashboard/components/EmployeeDashboard";
import { getDashboardData } from "@/shared/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function EmployeePage() {
  const data = await getDashboardData("employee");
  return <EmployeeDashboard data={data} />;
}
