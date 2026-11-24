import { redirect } from "next/navigation";
import { getDemoDashboardData } from "@/shared/lib/demo-data";
import { CODE_RED_BLUE_PROGRAM, CODE_RED_BLUE_SUPERVISOR_EMAIL, getRelatedProgramNames, normalizeAssignedProgramNames } from "@/shared/lib/constants";
import { isSupabaseConfigured } from "@/shared/lib/supabase/env";
import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { toCalendarTimeOffEntry } from "@/shared/lib/time-off-calendar";
import type {
  AdSlot,
  AdminProfile,
  AnalyticsSummary,
  AppRole,
  AppUser,
  CalendarTimeOffEntry,
  DashboardData,
  Message,
  MonthlyWinner,
  Notification,
  OceanAcademyBlackout,
  ProgramName,
  RequestView,
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
    approvedWorkers: workerProfiles.filter((profile) => profile.status !== "suspended")
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

async function loadApprovedSupervisorCalendarTimeOff(): Promise<CalendarTimeOffEntry[]> {
  const admin = createSupabaseAdminClient();
  const pageSize = 500;
  const supervisorIds = new Set<string>();

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await admin.from("users")
      .select("id")
      .eq("role", "supervisor")
      .order("id", { ascending: true })
      .range(start, start + pageSize - 1);

    if (error) throw new Error("Could not load supervisor calendar users.");
    data?.forEach((user) => supervisorIds.add(user.id));
    if ((data?.length ?? 0) < pageSize) break;
  }

  if (supervisorIds.size === 0) return [];

  const approvedTimeOff: CalendarTimeOffEntry[] = [];

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await admin.from("time_off_requests")
      .select("id,user_id,employee_name,program_name,start_date,end_date,status")
      .eq("status", "approved")
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(start, start + pageSize - 1);

    if (error) throw new Error("Could not load approved supervisor time off.");
    approvedTimeOff.push(...(data ?? [])
      .filter((request) => supervisorIds.has(request.user_id))
      .map(toCalendarTimeOffEntry));
    if ((data?.length ?? 0) < pageSize) break;
  }

  return approvedTimeOff;
}

async function loadEveryRequestRow(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: "requests" | "time_off_requests",
  orderBy: "created_at" | "start_date"
) {
  const pageSize = 500;
  const rows: unknown[] = [];

  for (let start = 0; ; start += pageSize) {
    const result = await supabase
      .from(table)
      .select("*")
      .order(orderBy, { ascending: table === "time_off_requests" })
      .order("id", { ascending: true })
      .range(start, start + pageSize - 1);

    if (result.error) return { data: null, error: result.error };
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < pageSize) return { data: rows, error: null };
  }
}

function workerProgramNames(profile: WorkerProfile) {
  return [...new Set([...profile.program_names, ...profile.approved_program_names])];
}

function supervisorProgramNames(profile?: SupervisorProfile) {
  return profile?.program_names?.length ? profile.program_names : [];
}

function filterCollectionsByProgram(
  data: DashboardCollections,
  programNames: ProgramName[]
): DashboardCollections {
  const scopedPrograms = new Set<ProgramName>(programNames);
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
    shifts,
    requests,
    timeOffRequests,
    oceanAcademyBlackouts: programNames.includes("Ocean Academy") ? data.oceanAcademyBlackouts : [],
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

function scopeDashboardDataForCurrentUser(
  data: DashboardCollections
): DashboardCollections {
  if (data.currentUser.role === "employee") {
    return {
      ...data,
      timeOffRequests: data.timeOffRequests.filter(
        (request) => request.user_id === data.currentUser.id
      )
    };
  }

  if (data.currentUser.role === "supervisor") {
    const currentSupervisorProfile = data.supervisorProfiles.find(
      (profile) => profile.user_id === data.currentUser.id
    );
    const assignedPrograms = supervisorProgramNames(currentSupervisorProfile);
    const fallbackPrograms: ProgramName[] =
      assignedPrograms.length === 0 &&
      data.currentUser.email.toLowerCase() === CODE_RED_BLUE_SUPERVISOR_EMAIL
        ? [CODE_RED_BLUE_PROGRAM]
        : assignedPrograms;

    return {
      ...filterCollectionsByProgram(data, fallbackPrograms),
      supervisorProfiles: currentSupervisorProfile ? [currentSupervisorProfile] : [],
      adminProfiles: []
    };
  }

  if (data.currentUser.role !== "admin") {
    return data;
  }

  const currentAdminProfile = data.adminProfiles.find(
    (profile) => profile.user_id === data.currentUser.id
  );

  if (currentAdminProfile?.status === "approved" && currentAdminProfile.is_super_admin) {
    return data;
  }

  const assignedPrograms = new Set(
    normalizeAssignedProgramNames(currentAdminProfile?.program_names ?? []).flatMap(getRelatedProgramNames)
  );

  return {
    ...data,
    adminProfiles: currentAdminProfile ? [currentAdminProfile] : [],
    timeOffRequests: data.timeOffRequests.filter((request) => {
      if (request.user_id === data.currentUser.id) return true;
      if (!assignedPrograms.has(request.program_name)) return false;
      const requesterRole = data.users.find((member) => member.id === request.user_id)?.role;
      return requesterRole === "supervisor" ||
        (requesterRole === "employee" && (
          request.status === "approved" || data.reviewableTimeOffRequestIds.includes(request.id)
        ));
    }),
    requests: data.requests.filter((request) => {
      const shift = data.shifts.find((item) => item.id === request.shift_id);
      return Boolean(shift && assignedPrograms.has(shift.program_name));
    })
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
    redirect("/auth");
  }

  const { data: accountActive } = await supabase.rpc("current_account_active");

  if (accountActive === false) {
    redirect("/auth");
  }

  const [
    usersResult,
    workerProfilesResult,
    supervisorProfilesResult,
    adminProfilesResult,
    shiftsResult,
    requestsResult,
    timeOffRequestsResult,
    blackoutsResult,
    reviewableTimeOffResult,
    requestViewsResult,
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
    loadEveryRequestRow(supabase, "requests", "created_at"),
    loadEveryRequestRow(supabase, "time_off_requests", "start_date"),
    supabase.from("ocean_academy_blackouts").select("*").order("start_date", { ascending: true }),
    supabase.rpc("current_reviewable_time_off_request_ids"),
    supabase.from("request_views").select("*").eq("reviewer_id", user.id),
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

  const allUsers = (usersResult.data ?? []) as AppUser[];
  const storedCurrentUser = allUsers.find((appUser) => appUser.id === user.id);

  if (storedCurrentUser?.deleted_at) {
    redirect("/auth");
  }

  const users = allUsers.filter((appUser) => !appUser.deleted_at);
  const workerProfiles = ((workerProfilesResult.data ?? []) as WorkerProfile[]).map((profile) => ({
    ...profile,
    program_names: normalizeAssignedProgramNames(Array.isArray(profile.program_names) ? profile.program_names : []),
    approved_program_names: normalizeAssignedProgramNames(Array.isArray(profile.approved_program_names) ? profile.approved_program_names : [])
  }));
  const supervisorProfiles = ((supervisorProfilesResult.data ?? []) as SupervisorProfile[]).map(
    (profile) => ({
      ...profile,
      program_names: normalizeAssignedProgramNames(Array.isArray(profile.program_names) ? profile.program_names : []),
      requested_program_names: Array.isArray(profile.requested_program_names)
        ? normalizeAssignedProgramNames(profile.requested_program_names)
        : null
    })
  );
  const adminProfiles = ((adminProfilesResult.data ?? []) as AdminProfile[]).map(
    (profile) => ({
      ...profile,
      program_names: normalizeAssignedProgramNames(Array.isArray(profile.program_names) ? profile.program_names : []),
      requested_program_names: Array.isArray(profile.requested_program_names)
        ? normalizeAssignedProgramNames(profile.requested_program_names)
        : null,
      is_super_admin: profile.is_super_admin === true
    })
  );
  const shifts = (shiftsResult.data ?? []) as ShiftPost[];
  const requests = (requestsResult.data ?? []) as ShiftRequest[];
  const timeOffRequests = (timeOffRequestsResult.data ?? []) as TimeOffRequest[];
  const oceanAcademyBlackouts = (blackoutsResult.data ?? []) as OceanAcademyBlackout[];
  const reviewableTimeOffRequestIds = reviewableTimeOffResult.data ?? [];
  const requestViews = (requestViewsResult.data ?? []) as RequestView[];
  const messages = (messagesResult.data ?? []) as Message[];
  const savedShifts = (savedShiftsResult.data ?? []) as SavedShift[];
  const notifications = (notificationsResult.data ?? []) as Notification[];
  const adSlots = (adSlotsResult.data ?? []) as AdSlot[];
  const monthlyWinners = (winnersResult.data ?? []) as MonthlyWinner[];

  if (user.user_metadata?.setup_required && !user.user_metadata?.setup_completed_at) {
    redirect("/auth/setup");
  }

  const currentUser = storedCurrentUser
    ? ({
        ...storedCurrentUser,
        last_sign_in_at: storedCurrentUser.last_sign_in_at ?? user.last_sign_in_at ?? storedCurrentUser.created_at
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

  const supervisorCalendarTimeOff = storedCurrentUser?.role === "supervisor"
    ? await loadApprovedSupervisorCalendarTimeOff()
    : [];

  const scopedData = scopeDashboardDataForCurrentUser({
    currentUser,
    users,
    workerProfiles,
    supervisorProfiles,
    adminProfiles,
    shifts,
    requests,
    timeOffRequests,
    supervisorCalendarTimeOff,
    oceanAcademyBlackouts,
    reviewableTimeOffRequestIds,
    requestViews,
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

/** Build a member's dashboard from data already loaded for a verified Super Admin. */
export function createMemberPreviewData(
  data: DashboardData,
  member: AppUser,
  requestViews: RequestView[],
  reviewableTimeOffRequestIds: string[],
  notifications: Notification[] = [],
  savedShifts: SavedShift[] = []
): DashboardData {
  const memberPrograms = data.workerProfiles.find((profile) => profile.user_id === member.id)?.program_names ?? [];
  const scopedNotifications = notifications.filter((item) =>
    item.user_id === member.id || (item.user_id === null && (item.role === member.role || item.role === "all"))
  );
  const memberCollections: DashboardCollections = {
    ...data,
    currentUser: member,
    adminProfiles: member.role === "admin"
      ? data.adminProfiles
      : data.adminProfiles.filter((profile) => profile.user_id === member.id),
    shifts: member.role === "employee"
      ? data.shifts.filter((shift) => memberPrograms.includes(shift.program_name))
      : data.shifts,
    requests: member.role === "employee"
      ? data.requests.filter((request) => request.requestor_id === member.id)
      : data.requests,
    timeOffRequests: member.role === "supervisor"
      ? data.timeOffRequests.filter((request) =>
          request.user_id === member.id ||
          data.users.find((user) => user.id === request.user_id)?.role === "employee"
        )
      : data.timeOffRequests,
    supervisorCalendarTimeOff: member.role === "supervisor"
      ? data.timeOffRequests.filter((request) =>
          request.status === "approved" &&
          data.users.some((user) => user.id === request.user_id && user.role === "supervisor")
        ).map(toCalendarTimeOffEntry)
      : [],
    messages: member.role === "employee"
      ? data.messages.filter((message) => message.sender_id === member.id || message.recipient_id === member.id)
      : data.messages,
    savedShifts: savedShifts.filter((shift) => shift.user_id === member.id),
    notifications: scopedNotifications,
    requestViews,
    reviewableTimeOffRequestIds
  };
  const scopedData = scopeDashboardDataForCurrentUser({
    ...memberCollections
  });

  return {
    ...scopedData,
    isDemo: data.isDemo,
    analytics: calculateAnalytics(
      scopedData.shifts,
      scopedData.requests,
      scopedData.timeOffRequests,
      scopedData.workerProfiles,
      scopedData.supervisorProfiles
    )
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
