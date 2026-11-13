import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { EmployeeDashboard } from "@/features/dashboard/components/EmployeeDashboard";
import { SupervisorDashboard } from "@/features/dashboard/components/SupervisorDashboard";
import { AdminEmployeesDashboard } from "@/features/employees/components/AdminEmployeesDashboard";
import { AccountTypesDashboard } from "@/features/employees/components/AccountTypesDashboard";
import { AdminReportsDashboard } from "@/features/reports/components/AdminReportsDashboard";
import { PendingAdminAccess } from "@/features/auth/components/PendingAdminAccess";
import { ViewAsMemberPicker } from "@/features/admin/components/ViewAsMemberPicker";
import { hasAdminAccess, hasSuperAdminAccess, hasSupervisorAccess } from "@/shared/lib/access";
import { createMemberPreviewData, getDashboardData } from "@/shared/lib/dashboard-data";
import { createSupabaseAdminClient, hasSupabaseServiceRoleKey } from "@/shared/lib/supabase/admin";
import { isSupabaseConfigured } from "@/shared/lib/supabase/env";
import { getTeamTimeOffDatesForCalendar } from "@/shared/lib/team-time-off.server";
import type { AppRole, Notification, RequestView, SavedShift } from "@/shared/types/domain";

export const dynamic = "force-dynamic";

type PreviewScreen = AppRole | "employees" | "account-types" | "reports";
type PreviewParams = { member?: string; screen?: string };

function previewScreen(role: AppRole, superAdmin: boolean, requested?: string): PreviewScreen {
  if (requested === "employee") return "employee";
  if (role !== "employee" && (requested === "employees" || requested === "reports")) return requested;
  if (superAdmin && requested === "account-types") return requested;
  return role;
}

export default async function ViewAsPage({
  searchParams
}: {
  searchParams: Promise<PreviewParams>;
}) {
  if (!isSupabaseConfigured()) redirect("/admin");

  const data = await getDashboardData("admin");
  if (!hasSuperAdminAccess(data)) redirect("/employee");

  const members = data.users
    .filter((user) => user.id !== data.currentUser.id)
    .map(({ id, full_name, email, role }) => ({ id, full_name, email, role }))
    .sort((first, second) => first.full_name.localeCompare(second.full_name));
  const params = await searchParams;
  const member = data.users.find((user) => user.id === params.member && user.id !== data.currentUser.id);

  if (!member) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-harbor-ocean hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Admin View
        </Link>
        <section className="panel mt-6 p-6 sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-harbor-mist text-harbor-ocean">
            <Eye className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="label mt-5 text-harbor-sky">Super Admin</p>
          <h1 className="mt-1 text-3xl font-semibold text-harbor-midnight">View site as</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-harbor-midnight/65">
            Choose a team member to see their dashboard and available features. The preview is read-only and keeps you signed in as a Super Admin.
          </p>
          <div className="mt-6 max-w-xl"><ViewAsMemberPicker members={members} /></div>
        </section>
      </main>
    );
  }

  const preliminaryData = createMemberPreviewData(data, member, [], []);
  let requestViews: RequestView[] = [];
  let notifications: Notification[] = [];
  let savedShifts: SavedShift[] = [];
  let reviewableTimeOffRequestIds: string[] = [];
  let previewDetailsAvailable = hasSupabaseServiceRoleKey();

  if (previewDetailsAvailable) {
    try {
      const admin = createSupabaseAdminClient();
      const [viewsResult, notificationsResult, savedShiftsResult, recipientResults] = await Promise.all([
        admin.from("request_views").select("reviewer_id,request_kind,request_id,viewed_at").eq("reviewer_id", member.id),
        admin.from("notifications").select("*").or(`user_id.eq.${member.id},role.eq.${member.role},role.eq.all`),
        admin.from("saved_shifts").select("*").eq("user_id", member.id),
        Promise.all(preliminaryData.timeOffRequests.map((request) =>
          admin.rpc("request_review_recipients", {
            target_kind: "time-off",
            target_program: request.program_name,
            target_requester_id: request.user_id
          })
        ))
      ]);

      if (viewsResult.error || notificationsResult.error || savedShiftsResult.error || recipientResults.some((result) => result.error)) {
        console.error("Member preview details could not be loaded", {
          views: viewsResult.error,
          notifications: notificationsResult.error,
          savedShifts: savedShiftsResult.error,
          recipients: recipientResults.filter((result) => result.error).map((result) => result.error)
        });
        previewDetailsAvailable = false;
      } else {
        requestViews = (viewsResult.data ?? []) as RequestView[];
        notifications = (notificationsResult.data ?? []) as Notification[];
        savedShifts = (savedShiftsResult.data ?? []) as SavedShift[];
        reviewableTimeOffRequestIds = preliminaryData.timeOffRequests.flatMap((request, index) =>
          recipientResults[index].data?.some((recipient) => recipient.user_id === member.id) ? [request.id] : []
        );
      }
    } catch (error) {
      console.error("Member preview details could not be loaded", error);
      previewDetailsAvailable = false;
    }
  }

  const previewData = createMemberPreviewData(
    data,
    member,
    requestViews,
    reviewableTimeOffRequestIds,
    notifications,
    savedShifts
  );
  const memberIsSuperAdmin = hasSuperAdminAccess(previewData);
  const screen = previewScreen(member.role, memberIsSuperAdmin, params.screen);
  const previewTeamAvailability = screen === "employee" && member.role === "employee"
    ? await getTeamTimeOffDatesForCalendar(
        member.id,
        data.workerProfiles.find((profile) => profile.user_id === member.id)?.approved_program_names ?? []
      )
    : { dates: [], available: true };
  const memberUrl = `/view-as?member=${encodeURIComponent(member.id)}`;
  const availableScreens: { key: PreviewScreen; label: string }[] = [
    ...(member.role === "admin" ? [{ key: "admin" as const, label: "Admin View" }] : []),
    ...(member.role === "supervisor" ? [{ key: "supervisor" as const, label: "Supervisor View" }] : []),
    { key: "employee", label: "Employee View" },
    ...(member.role !== "employee" ? [
      { key: "employees" as const, label: "Employee Info" },
      { key: "reports" as const, label: "Reports" }
    ] : []),
    ...(memberIsSuperAdmin ? [{ key: "account-types" as const, label: "Account Types" }] : [])
  ];

  return (
    <div>
      <div className="sticky top-[65px] z-[80] border-b border-harbor-ocean/15 bg-harbor-midnight px-4 py-3 text-white shadow-line sm:top-[84px] sm:px-6">
        <div className="mx-auto flex max-w-[96rem] flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Eye className="h-5 w-5 shrink-0 text-harbor-lemon" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Viewing as {member.full_name} <span className="font-normal text-white/65">· {member.role}</span></p>
              <p className="truncate text-xs text-white/70">{member.email} · Read-only preview · Actions are disabled</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2 text-xs font-semibold">
            <Link href="/view-as" className="rounded-lg border border-white/25 px-3 py-2 text-white hover:bg-white/10">Change member</Link>
            <Link href="/admin" className="rounded-lg bg-harbor-lemon px-3 py-2 text-harbor-midnight hover:bg-white">Exit preview</Link>
          </div>
        </div>
      </div>

      <nav aria-label="Member preview pages" className="mx-auto flex max-w-[96rem] flex-wrap gap-2 px-4 pt-5 sm:px-6 lg:px-8">
        {availableScreens.map((item) => (
          <Link key={item.key} href={`${memberUrl}&screen=${item.key}`} aria-current={screen === item.key ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold ${screen === item.key ? "bg-harbor-midnight text-white" : "bg-white text-harbor-ocean shadow-line"}`}>
            {item.label}
          </Link>
        ))}
      </nav>

      {!previewDetailsAvailable ? (
        <p role="status" className="mx-auto mt-4 max-w-[96rem] px-4 text-sm text-harbor-ocean sm:px-6 lg:px-8">
          Some personal notifications and request details are temporarily unavailable in this preview.
        </p>
      ) : null}

      <div inert className="pointer-events-none select-none" aria-label="Read-only member dashboard preview">
        {screen === "employee" ? (
          <EmployeeDashboard data={previewData} teamTimeOffDates={previewTeamAvailability.dates} teamAvailabilityAvailable={previewTeamAvailability.available} />
        ) : screen === "employees" ? (
          <AdminEmployeesDashboard data={previewData} />
        ) : screen === "reports" ? (
          <AdminReportsDashboard data={previewData} />
        ) : screen === "account-types" ? (
          <AccountTypesDashboard data={previewData} />
        ) : screen === "admin" && !hasAdminAccess(previewData) ? (
          <PendingAdminAccess suspended={previewData.adminProfiles.find((profile) => profile.user_id === member.id)?.status === "suspended"} />
        ) : screen === "supervisor" && !hasSupervisorAccess(previewData) ? (
          <EmployeeDashboard data={previewData} />
        ) : (
          <SupervisorDashboard data={previewData} role={screen as AppRole} showAdminModeration={screen === "admin"} />
        )}
      </div>
    </div>
  );
}
