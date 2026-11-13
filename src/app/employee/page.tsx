import { EmployeeDashboard } from "@/features/dashboard/components/EmployeeDashboard";
import { getDashboardData } from "@/shared/lib/dashboard-data";
import { getTeamTimeOffDatesForCalendar } from "@/shared/lib/team-time-off.server";

export const dynamic = "force-dynamic";

export default async function EmployeePage() {
  const data = await getDashboardData("employee");
  const approvedPrograms = data.workerProfiles.find(
    (profile) => profile.user_id === data.currentUser.id
  )?.approved_program_names ?? [];
  const teamAvailability = await getTeamTimeOffDatesForCalendar(data.currentUser.id, approvedPrograms);

  return <EmployeeDashboard data={data} teamTimeOffDates={teamAvailability.dates} teamAvailabilityAvailable={teamAvailability.available} />;
}
