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
  ProgramName,
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

type DashboardCollections = Omit<DashboardData, "analytics" | "isDemo">;

function workerProgramNames(profile: WorkerProfile) {
  return profile.program_names?.length ? profile.program_names : [profile.program_name];
}

function scopeDashboardDataForCurrentUser(
  data: DashboardCollections
): DashboardCollections {
  if (data.currentUser.role !== "admin") {
    return data;
  }

  const currentAdminProfile = data.adminProfiles.find(
    (profile) => profile.user_id === data.currentUser.id
  );

  if (currentAdminProfile?.is_super_admin) {
    return data;
  }

  const scopedPrograms = new Set<ProgramName>(currentAdminProfile?.program_names ?? []);
  const canSeeProgram = (programName: string) =>
    scopedPrograms.has(programName as ProgramName);

  const shifts = data.shifts.filter((shift) => canSeeProgram(shift.program_name));
  const visibleShiftIds = new Set(shifts.map((shift) => shift.id));
  const requests = data.requests.filter((request) => visibleShiftIds.has(request.shift_id));
  const timeOffRequests = data.timeOffRequests.filter((request) =>
    canSeeProgram(request.program_name)
  );
  const workerProfiles = data.workerProfiles.filter((profile) =>
    workerProgramNames(profile).some((programName) => canSeeProgram(programName))
  );

  const visibleUserIds = new Set<string>([data.currentUser.id]);
  workerProfiles.forEach((profile) => visibleUserIds.add(profile.user_id));
  requests.forEach((request) => visibleUserIds.add(request.requestor_id));
  timeOffRequests.forEach((request) => visibleUserIds.add(request.user_id));
  shifts.forEach((shift) => {
    visibleUserIds.add(shift.created_by);
    if (shift.owner_user_id) {
      visibleUserIds.add(shift.owner_user_id);
    }
  });

  const visibleRequestIds = new Set(requests.map((request) => request.id));
  const messages = data.messages.filter(
    (message) =>
      (message.shift_id ? visibleShiftIds.has(message.shift_id) : false) ||
      (message.request_id ? visibleRequestIds.has(message.request_id) : false) ||
      visibleUserIds.has(message.sender_id) ||
      (message.recipient_id ? visibleUserIds.has(message.recipient_id) : false)
  );

  return {
    ...data,
    users: data.users.filter((user) => visibleUserIds.has(user.id)),
    workerProfiles,
    supervisorProfiles: [],
    adminProfiles: currentAdminProfile ? [currentAdminProfile] : [],
    shifts,
    requests,
    timeOffRequests,
    messages,
    savedShifts: data.savedShifts.filter(
      (savedShift) =>
        visibleShiftIds.has(savedShift.shift_id) || visibleUserIds.has(savedShift.user_id)
    ),
    adSlots: data.adSlots.filter((adSlot) => canSeeProgram(adSlot.program_name)),
    monthlyWinners: data.monthlyWinners.filter((winner) =>
      visibleUserIds.has(winner.user_id)
    )
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
  const adminProfiles = ((adminProfilesResult.data ?? []) as AdminProfile[]).map(
    (profile) => ({
      ...profile,
      program_names: Array.isArray(profile.program_names) ? profile.program_names : [],
      is_super_admin: profile.is_super_admin === true
    })
  );
  const shifts = (shiftsResult.data ?? []) as ShiftPost[];
  const requests = (requestsResult.data ?? []) as ShiftRequest[];
  const timeOffRequests = (timeOffRequestsResult.data ?? []) as TimeOffRequest[];
  const messages = (messagesResult.data ?? []) as Message[];
  const savedShifts = (savedShiftsResult.data ?? []) as SavedShift[];
  const notifications = (notificationsResult.data ?? []) as Notification[];
  const adSlots = (adSlotsResult.data ?? []) as AdSlot[];
  const monthlyWinners = (winnersResult.data ?? []) as MonthlyWinner[];

  const storedCurrentUser = users.find((appUser) => appUser.id === user.id);
  const currentUser = storedCurrentUser
    ? ({
        ...storedCurrentUser,
        last_sign_in_at: user.last_sign_in_at ?? storedCurrentUser.created_at
      } satisfies AppUser)
    : ({
        id: user.id,
        email: user.email ?? "",
        full_name: user.user_metadata?.full_name ?? user.email ?? "Team member",
        role,
        avatar_url: user.user_metadata?.avatar_url ?? null,
        phone: null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? user.created_at
      } satisfies AppUser);

  const scopedData = scopeDashboardDataForCurrentUser({
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
    monthlyWinners
  });

  return {
    ...scopedData,
    analytics: calculateAnalytics(
      scopedData.shifts,
      scopedData.requests,
      scopedData.timeOffRequests,
      scopedData.workerProfiles,
      scopedData.supervisorProfiles
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
