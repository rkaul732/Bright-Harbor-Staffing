import { redirect } from "next/navigation";
import { AdminEmployeesDashboard } from "@/features/employees/components/AdminEmployeesDashboard";
import { hasAdminAccess } from "@/shared/lib/access";
import { getDashboardData } from "@/shared/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const data = await getDashboardData("admin");

  if (!hasAdminAccess(data)) {
    redirect("/employee");
  }

  return <AdminEmployeesDashboard data={data} />;
}
