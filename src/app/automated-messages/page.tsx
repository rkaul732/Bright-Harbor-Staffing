import { redirect } from "next/navigation";
import { AutomatedMessagesDashboard } from "@/features/automated-messages/components/AutomatedMessagesDashboard";
import { hasSuperAdminAccess } from "@/shared/lib/access";
import { getAutomatedMessagesData } from "@/shared/lib/automated-messages";
import { getDashboardData } from "@/shared/lib/dashboard-data";
import { DashboardShell } from "@/shared/components/DashboardShell";

export const dynamic = "force-dynamic";

export default async function AutomatedMessagesPage() {
  const data = await getDashboardData("admin");

  if (!hasSuperAdminAccess(data)) {
    redirect("/admin");
  }

  const messagesData = await getAutomatedMessagesData();

  return (
    <DashboardShell role="admin" data={data}>
      <AutomatedMessagesDashboard {...messagesData} />
    </DashboardShell>
  );
}
