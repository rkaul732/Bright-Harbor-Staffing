import { redirect } from "next/navigation";
import { AccountTypesDashboard } from "@/features/employees/components/AccountTypesDashboard";
import { hasSuperAdminAccess } from "@/shared/lib/access";
import { getDashboardData } from "@/shared/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AccountTypesPage() {
  const data = await getDashboardData("admin");

  if (!hasSuperAdminAccess(data)) {
    redirect("/employees");
  }

  return <AccountTypesDashboard data={data} />;
}
