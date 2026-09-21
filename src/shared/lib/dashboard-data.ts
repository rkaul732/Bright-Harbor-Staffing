import { redirect } from "next/navigation";
import { getDemoDashboardData } from "@/shared/lib/demo-data";
import { isSupabaseConfigured } from "@/shared/lib/supabase/env";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import type {
  AdSlot,
  AdminProfile,
  AnalyticsSummary,
  AppRole,
  AppUser,
  DashboardData,
  Message,
  MonthlyWinner,
  Notification,
  SavedShift,
  ShiftPost,
  ShiftRequest,
  SupervisorProfile,
  TimeOffRequest,
  WorkerProfile
} from "@/shared/types/domain";

function calculateAnalytics(
  shifts: ShiftPost[],
  requests: ShiftRequest[],
  timeOffRequests: TimeOffRequest[],
  workerProfiles: WorkerProfile[],
  supervisorProfiles: SupervisorProfile[]
): AnalyticsSummary {
  const currentMonth = new Date().toISOString().slice(0, 7);

  return {
    openShifts: shifts.filter((shift) => shift.status === "open").length,
    coveredShifts: shifts.filter((shift) => shift.status === "covered").length,
    pendingRequests: requests.filter(
      (request) => request.status === "pending_supervisor_approval"
    ).length,
    pendingTimeOffRequests: timeOffRequests.filter(
      (request) => request.status === "pending_supervisor_approval"
    ).length,
    approvedWorkers: workerProfiles.filter((profile) => profile.status === "approved")
      .length,
    activeSupervisors: supervisorProfiles.filter(
      (profile) => profile.status === "approved"
    ).length,
    thisMonthRequests: requests.filter((request) =>
      request.created_at.startsWith(currentMonth)
    ).length
  };
}

export async function getDashboardData(role: AppRole): Promise<DashboardData> {
  if (!isSupabaseConfigured()) {
    return getDemoDashboardData(role);
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth?role=${role}`);
  }

  const [
    usersResult,
    workerProfilesResult,
    supervisorProfilesResult,
    adminProfilesResult,
    shiftsResult,
    requestsResult,
    timeOffRequestsResult,
    messagesResult,
    savedShiftsResult,
    notificationsResult,
    adSlotsResult,
    winnersResult
  ] = await Promise.all([
    supabase.from("users").select("*").order("created_at", { ascending: false }),
    supabase.from("worker_profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("supervisor_profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("admin_profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("shift_posts").select("*").order("shift_date", { ascending: true }),
    supabase.from("requests").select("*").order("created_at", { ascending: false }),
    supabase
      .from("time_off_requests")
      .select("*")
      .order("start_date", { ascending: true }),
    supabase.from("messages").select("*").order("created_at", { ascending: false }),
    supabase.from("saved_shifts").select("*").order("created_at", { ascending: false }),
    supabase.from("notifications").select("*").order("created_at", { ascending: false }),
    supabase
      .from("ad_slots")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false }),
    supabase.from("monthly_winners").select("*").order("month", { ascending: false })
  ]);

  const users = (usersResult.data ?? []) as AppUser[];
  const workerProfiles = (workerProfilesResult.data ?? []) as WorkerProfile[];
  const supervisorProfiles = (supervisorProfilesResult.data ?? []) as SupervisorProfile[];
  const adminProfiles = (adminProfilesResult.data ?? []) as AdminProfile[];
  const shifts = (shiftsResult.data ?? []) as ShiftPost[];
  const requests = (requestsResult.data ?? []) as ShiftRequest[];
  const timeOffRequests = (timeOffRequestsResult.data ?? []) as TimeOffRequest[];
  const messages = (messagesResult.data ?? []) as Message[];
  const savedShifts = (savedShiftsResult.data ?? []) as SavedShift[];
  const notifications = (notificationsResult.data ?? []) as Notification[];
  const adSlots = (adSlotsResult.data ?? []) as AdSlot[];
  const monthlyWinners = (winnersResult.data ?? []) as MonthlyWinner[];

  const currentUser =
    users.find((appUser) => appUser.id === user.id) ??
    ({
      id: user.id,
      email: user.email ?? "",
      full_name: user.user_metadata?.full_name ?? user.email ?? "Team member",
      role,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      phone: null,
      created_at: user.created_at
    } satisfies AppUser);

  return {
    currentUser,
    users,
    workerProfiles,
    supervisorProfiles,
    adminProfiles,
    shifts,
    requests,
    timeOffRequests,
    messages,
    savedShifts,
    notifications,
    adSlots,
    monthlyWinners,
    analytics: calculateAnalytics(
      shifts,
      requests,
      timeOffRequests,
      workerProfiles,
      supervisorProfiles
    ),
    isDemo: false
  };
}

export async function getMonthlyWinners() {
  if (!isSupabaseConfigured()) {
    return getDemoDashboardData("employee").monthlyWinners;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("monthly_winners")
    .select("*")
    .order("month", { ascending: false });

  return (data ?? []) as MonthlyWinner[];
}
