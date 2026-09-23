"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  APPROVAL_SUPERVISOR_EMAIL,
  FIXED_EMERGENCY_PAY_RATE,
  FIXED_STANDARD_PAY_RATE,
  PROGRAMS,
  LOCATIONS,
  SKILLS,
  canUseShiftExchange
} from "@/shared/lib/constants";
import { isSupabaseConfigured } from "@/shared/lib/supabase/env";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import type {
  AppRole,
  LocationName,
  ProgramName,
  ProfileStatus,
  RequestStatus,
  SkillName
} from "@/shared/types/domain";

type ActionState = {
  ok: boolean;
  message: string;
};

const locationSchema = z.enum(LOCATIONS as [LocationName, ...LocationName[]]);
const programSchema = z.enum(PROGRAMS as [ProgramName, ...ProgramName[]]);
const skillSchema = z.enum(SKILLS as [SkillName, ...SkillName[]]);

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time.");

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asSkills(formData: FormData) {
  return formData
    .getAll("requirements")
    .filter((value): value is SkillName => skillSchema.safeParse(value).success);
}

function asPrograms(formData: FormData) {
  return formData
    .getAll("program_names")
    .filter((value): value is ProgramName => programSchema.safeParse(value).success);
}

async function getUserForAction(roleHint?: AppRole) {
  if (!isSupabaseConfigured()) {
    return {
      id:
        roleHint === "supervisor"
          ? "user-supervisor-1"
          : roleHint === "admin"
            ? "user-admin-1"
            : "user-employee-1",
      email:
        roleHint === "supervisor"
          ? APPROVAL_SUPERVISOR_EMAIL
          : roleHint === "admin"
            ? "admin@example.com"
            : "employee@example.com",
      full_name:
        roleHint === "supervisor"
          ? "B. Pataky"
          : roleHint === "admin"
            ? "Alex Morgan"
            : "Jamie Rivera",
      role: roleHint ?? "employee"
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("You must be signed in to complete this action.");
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? appUser?.email ?? "",
    full_name:
      appUser?.full_name ?? user.user_metadata?.full_name ?? user.email ?? "Team member",
    role: (appUser?.role ?? roleHint ?? "employee") as AppRole
  };
}

async function getWorkerProgramsForAction(userId: string) {
  if (!isSupabaseConfigured()) {
    return ["Beacon/ Anchor", "Bayside"] satisfies ProgramName[];
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("worker_profiles")
    .select("program_name,program_names")
    .eq("user_id", userId)
    .single();

  const programNames = data?.program_names as ProgramName[] | null | undefined;

  if (programNames?.length) {
    return programNames;
  }

  return data?.program_name ? [data.program_name as ProgramName] : [];
}

function revalidateDashboards() {
  revalidatePath("/");
  revalidatePath("/employee");
  revalidatePath("/supervisor");
  revalidatePath("/admin");
  revalidatePath("/monthly-winners");
  revalidatePath("/reports");
}

export async function employeePostShiftAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = z
    .object({
      program_name: programSchema,
      location_name: locationSchema,
      shift_date: dateSchema,
      start_time: timeSchema,
      end_time: timeSchema,
      details: z.string().min(8, "Add a little context for the supervisor.")
    })
    .safeParse({
      program_name: asString(formData.get("program_name")),
      location_name: asString(formData.get("location_name")),
      shift_date: asString(formData.get("shift_date")),
      start_time: asString(formData.get("start_time")),
      end_time: asString(formData.get("end_time")),
      details: asString(formData.get("details"))
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const user = await getUserForAction("employee");
  const programNames = await getWorkerProgramsForAction(user.id);

  if (
    !programNames.includes(parsed.data.program_name) ||
    !canUseShiftExchange(parsed.data.program_name)
  ) {
    return {
      ok: false,
      message: "Choose one of your shift-eligible programs."
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      message: `Demo mode: coverage request routed to ${APPROVAL_SUPERVISOR_EMAIL}.`
    };
  }

  const supabase = await createSupabaseServerClient();
  const insert = {
    ...parsed.data,
    title: `Coverage needed - ${parsed.data.location_name}`,
    requirements: ["Direct care" as SkillName],
    openings: 1,
    filled_openings: 0,
    pay_rate: FIXED_STANDARD_PAY_RATE,
    category: "standard" as const,
    urgent: false,
    status: "open" as const,
    created_by: user.id,
    posted_by_role: "employee" as const,
    owner_user_id: user.id,
    supervisor_email: APPROVAL_SUPERVISOR_EMAIL
  };

  const { error } = await supabase.from("shift_posts").insert(insert);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateDashboards();
  return {
    ok: true,
    message: `Posted for coverage and routed to ${APPROVAL_SUPERVISOR_EMAIL}.`
  };
}

export async function updateWorkerProfileAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getUserForAction("employee");
  const programNames = asPrograms(formData);
  const skills = asSkills(formData);
  const availability = asString(formData.get("availability"))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const phone = asString(formData.get("phone"));
  const fullName = asString(formData.get("full_name")) || user.full_name;
  const preferredContact = asString(formData.get("preferred_contact"));
  const photo = formData.get("photo");

  if (programNames.length === 0) {
    return { ok: false, message: "Choose at least one program." };
  }

  if (skills.length === 0) {
    return { ok: false, message: "Choose at least one skill." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: employee profile updated." };
  }

  const supabase = await createSupabaseServerClient();
  let photoUrl: string | null = null;

  if (photo instanceof File && photo.size > 0) {
    const extension = photo.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(path, photo, { upsert: true });

    if (uploadError) {
      return { ok: false, message: uploadError.message };
    }

    const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
    photoUrl = data.publicUrl;
  }

  await supabase
    .from("users")
    .update({
      full_name: fullName,
      phone: phone || null,
      avatar_url: photoUrl
    })
    .eq("id", user.id);

  const { error } = await supabase.from("worker_profiles").upsert(
    {
      user_id: user.id,
      status: "pending",
      program_name: programNames[0],
      program_names: programNames,
      availability,
      skills,
      account_information: { preferredContact },
      photo_url: photoUrl
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateDashboards();
  return { ok: true, message: "Employee profile submitted for approval." };
}

export async function updateSupervisorProfileAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getUserForAction("supervisor");
  const parsed = z
    .object({
      location_name: locationSchema,
      front_desk_location_name: z.string().min(3, "Add the location profile name."),
      title: z.string().min(2, "Add a title.")
    })
    .safeParse({
      location_name: asString(formData.get("location_name")),
      front_desk_location_name: asString(formData.get("front_desk_location_name")),
      title: asString(formData.get("title"))
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: supervisor profile updated." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("supervisor_profiles").upsert(
    {
      user_id: user.id,
      status: "pending",
      ...parsed.data
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateDashboards();
  return { ok: true, message: "Supervisor profile submitted for approval." };
}

export async function supervisorPostShiftAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const category = asString(formData.get("category")) === "emergency" ? "emergency" : "standard";
  const role = (asString(formData.get("role")) as AppRole) || "supervisor";
  const payRate =
    category === "emergency" ? FIXED_EMERGENCY_PAY_RATE : FIXED_STANDARD_PAY_RATE;

  const parsed = z
    .object({
      title: z.string().min(3, "Add a shift title."),
      details: z.string().min(6, "Add shift details."),
      program_name: programSchema,
      location_name: locationSchema,
      shift_date: dateSchema,
      start_time: timeSchema,
      end_time: timeSchema,
      openings: z.number().int().min(1).max(20),
      urgent: z.boolean(),
      category: z.enum(["standard", "emergency"]),
      pay_rate: z.number().min(FIXED_STANDARD_PAY_RATE)
    })
    .safeParse({
      title: asString(formData.get("title")),
      details: asString(formData.get("details")),
      program_name: asString(formData.get("program_name")),
      location_name: asString(formData.get("location_name")),
      shift_date: asString(formData.get("shift_date")),
      start_time: asString(formData.get("start_time")),
      end_time: asString(formData.get("end_time")),
      openings: asNumber(formData.get("openings"), 1),
      urgent: formData.get("urgent") === "on",
      category,
      pay_rate: payRate
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const user = await getUserForAction(role === "admin" ? "admin" : "supervisor");

  if (!["supervisor", "admin"].includes(user.role)) {
    return { ok: false, message: "Only supervisors and admins can create this posting." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: shift posting saved for preview." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("shift_posts").insert({
    ...parsed.data,
    requirements: asSkills(formData),
    filled_openings: 0,
    status: "open",
    created_by: user.id,
    posted_by_role: user.role,
    owner_user_id: null,
    supervisor_email: APPROVAL_SUPERVISOR_EMAIL
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateDashboards();
  return { ok: true, message: "Shift posting is live." };
}

export async function requestShiftAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const shiftId = asString(formData.get("shift_id"));
  const note = asString(formData.get("note"));
  const user = await getUserForAction("employee");
  const programNames = await getWorkerProgramsForAction(user.id);

  if (!shiftId) {
    return { ok: false, message: "Choose a shift first." };
  }

  if (!canUseShiftExchange(programNames)) {
    return {
      ok: false,
      message: "Your program can submit time off requests only."
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      message: `Demo mode: request routed to ${APPROVAL_SUPERVISOR_EMAIL} for approval.`
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: shift } = await supabase
    .from("shift_posts")
    .select("program_name")
    .eq("id", shiftId)
    .single();

  if (!shift || !programNames.includes(shift.program_name as ProgramName)) {
    return { ok: false, message: "Choose a shift from one of your programs." };
  }

  const { error } = await supabase.from("requests").insert({
    shift_id: shiftId,
    requestor_id: user.id,
    requestor_name: user.full_name,
    note: note || null,
    status: "pending_supervisor_approval",
    supervisor_email: APPROVAL_SUPERVISOR_EMAIL
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  await supabase.from("notifications").insert({
    user_id: null,
    role: "supervisor",
    title: "Shift approval needed",
    body: `${user.full_name} requested a shift. Approval routed to ${APPROVAL_SUPERVISOR_EMAIL}.`
  });

  revalidateDashboards();
  return { ok: true, message: `Request sent to ${APPROVAL_SUPERVISOR_EMAIL}.` };
}

export async function saveShiftAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const shiftId = asString(formData.get("shift_id"));
  const user = await getUserForAction("employee");

  if (!shiftId) {
    return { ok: false, message: "Choose a shift first." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: shift saved." };
  }

  const supabase = await createSupabaseServerClient();
  const programNames = await getWorkerProgramsForAction(user.id);
  const { data: shift } = await supabase
    .from("shift_posts")
    .select("program_name")
    .eq("id", shiftId)
    .single();

  if (!shift || !programNames.includes(shift.program_name as ProgramName)) {
    return { ok: false, message: "Choose a shift from one of your programs." };
  }

  const { error } = await supabase
    .from("saved_shifts")
    .upsert({ shift_id: shiftId, user_id: user.id }, { onConflict: "shift_id,user_id" });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateDashboards();
  return { ok: true, message: "Shift saved." };
}

export async function submitTimeOffRequestAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getUserForAction("employee");
  const programNames = await getWorkerProgramsForAction(user.id);

  const parsed = z
    .object({
      program_name: programSchema,
      start_date: dateSchema,
      end_date: dateSchema,
      reason: z.string().min(4, "Add a short reason for the request.")
    })
    .refine((value) => value.end_date >= value.start_date, {
      message: "End date must be on or after the start date."
    })
    .safeParse({
      program_name: asString(formData.get("program_name")),
      start_date: asString(formData.get("start_date")),
      end_date: asString(formData.get("end_date")),
      reason: asString(formData.get("reason"))
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  if (programNames.length === 0) {
    return { ok: false, message: "Save your employee program before requesting time off." };
  }

  if (!programNames.includes(parsed.data.program_name)) {
    return { ok: false, message: "Choose one of your selected programs." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: time off request submitted." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("time_off_requests").insert({
    user_id: user.id,
    employee_name: user.full_name,
    ...parsed.data,
    status: "pending_supervisor_approval"
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateDashboards();
  return { ok: true, message: "Time off request submitted." };
}

export async function adminAddOutOfOfficeAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getUserForAction("admin");
  const parsed = z
    .object({
      program_name: programSchema,
      start_date: dateSchema,
      end_date: dateSchema,
      reason: z.string().optional()
    })
    .refine((value) => value.end_date >= value.start_date, {
      message: "End date must be on or after the start date."
    })
    .safeParse({
      program_name: asString(formData.get("program_name")),
      start_date: asString(formData.get("start_date")),
      end_date: asString(formData.get("end_date")),
      reason: asString(formData.get("reason"))
    });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  if (user.role !== "admin") {
    return { ok: false, message: "Only admins can add direct OOO days." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: OOO added to the admin calendar." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("time_off_requests").insert({
    user_id: user.id,
    employee_name: user.full_name,
    program_name: parsed.data.program_name,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    reason: parsed.data.reason || "Admin-added OOO",
    status: "approved",
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    review_comment: "Added by admin without approval routing."
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateDashboards();
  return { ok: true, message: "OOO added to the team schedule." };
}

export async function updateTimeOffRequestStatusAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const requestId = asString(formData.get("request_id"));
  const status = asString(formData.get("status")) as RequestStatus;
  const reviewComment = asString(formData.get("review_comment"));
  const user = await getUserForAction(asString(formData.get("role")) === "admin" ? "admin" : "supervisor");

  if (!["approved", "declined", "cancelled"].includes(status)) {
    return { ok: false, message: "Choose a valid review action." };
  }

  if (!requestId) {
    return { ok: false, message: "Missing time off request details." };
  }

  if (!["supervisor", "admin"].includes(user.role)) {
    return { ok: false, message: "Only supervisors and admins can review requests." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: `Demo mode: time off request marked ${status}.` };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("time_off_requests")
    .update({
      status: status as "approved" | "declined" | "cancelled",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_comment: reviewComment || null
    })
    .eq("id", requestId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateDashboards();
  return { ok: true, message: `Time off request ${status}.` };
}

export async function updateRequestStatusAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const requestId = asString(formData.get("request_id"));
  const shiftId = asString(formData.get("shift_id"));
  const status = asString(formData.get("status")) as RequestStatus;
  const reviewComment = asString(formData.get("review_comment"));
  const user = await getUserForAction(asString(formData.get("role")) === "admin" ? "admin" : "supervisor");

  if (!["approved", "declined", "cancelled"].includes(status)) {
    return { ok: false, message: "Choose a valid review action." };
  }

  if (!requestId || !shiftId) {
    return { ok: false, message: "Missing request details." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: `Demo mode: request marked ${status}.` };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("requests")
    .update({
      status: status as "approved" | "declined" | "cancelled",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_comment: reviewComment || null
    })
    .eq("id", requestId);

  if (error) {
    return { ok: false, message: error.message };
  }

  if (status === "approved") {
    const { data: shift } = await supabase
      .from("shift_posts")
      .select("openings, filled_openings")
      .eq("id", shiftId)
      .single();

    if (shift) {
      const filled = Math.min(shift.openings, (shift.filled_openings ?? 0) + 1);
      await supabase
        .from("shift_posts")
        .update({
          filled_openings: filled,
          status: filled >= shift.openings ? "covered" : "open"
        })
        .eq("id", shiftId);
    }
  }

  revalidateDashboards();
  return { ok: true, message: `Request ${status}.` };
}

export async function sendMessageAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const role = (asString(formData.get("role")) as AppRole) || "employee";
  const user = await getUserForAction(role);
  const body = asString(formData.get("body"));

  if (body.length < 2) {
    return { ok: false, message: "Add a message first." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: message queued." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("messages").insert({
    request_id: asString(formData.get("request_id")) || null,
    shift_id: asString(formData.get("shift_id")) || null,
    recipient_id: asString(formData.get("recipient_id")) || null,
    sender_id: user.id,
    sender_name: user.full_name,
    body
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateDashboards();
  return { ok: true, message: "Message sent." };
}

export async function rescheduleShiftAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getUserForAction((asString(formData.get("role")) as AppRole) || "employee");
  const shiftId = asString(formData.get("shift_id"));
  const parsed = z
    .object({
      new_shift_date: dateSchema,
      new_start_time: timeSchema,
      new_end_time: timeSchema,
      reason: z.string().optional()
    })
    .safeParse({
      new_shift_date: asString(formData.get("new_shift_date")),
      new_start_time: asString(formData.get("new_start_time")),
      new_end_time: asString(formData.get("new_end_time")),
      reason: asString(formData.get("reason"))
    });

  if (!shiftId || !parsed.success) {
    return { ok: false, message: "Check the reschedule details." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: reschedule request logged." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: shift } = await supabase
    .from("shift_posts")
    .select("shift_date,start_time,end_time")
    .eq("id", shiftId)
    .single();

  if (!shift) {
    return { ok: false, message: "Shift not found." };
  }

  const { error } = await supabase.from("reschedules").insert({
    shift_id: shiftId,
    requested_by: user.id,
    old_shift_date: shift.shift_date,
    old_start_time: shift.start_time,
    old_end_time: shift.end_time,
    ...parsed.data,
    status: "pending_supervisor_approval"
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateDashboards();
  return { ok: true, message: "Reschedule request sent for approval." };
}

export async function cancelShiftAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getUserForAction((asString(formData.get("role")) as AppRole) || "employee");
  const shiftId = asString(formData.get("shift_id"));
  const reason = asString(formData.get("reason"));

  if (!shiftId || reason.length < 3) {
    return { ok: false, message: "Add a cancellation reason." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: cancellation request logged." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("cancelations").insert({
    shift_id: shiftId,
    requested_by: user.id,
    reason,
    status: "pending_supervisor_approval"
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateDashboards();
  return { ok: true, message: "Cancellation request sent for approval." };
}

export async function moderateProfileAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const role = asString(formData.get("profile_role")) as AppRole;
  const profileId = asString(formData.get("profile_id"));
  const status = asString(formData.get("status")) as ProfileStatus;
  await getUserForAction("admin");

  if (!["approved", "suspended", "pending"].includes(status) || !profileId) {
    return { ok: false, message: "Choose a valid profile status." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: `Demo mode: profile marked ${status}.` };
  }

  const supabase = await createSupabaseServerClient();
  const result =
    role === "supervisor"
      ? await supabase
          .from("supervisor_profiles")
          .update({ status })
          .eq("id", profileId)
      : role === "admin"
        ? await supabase
            .from("admin_profiles")
            .update({ status })
            .eq("id", profileId)
        : await supabase
            .from("worker_profiles")
            .update({ status })
            .eq("id", profileId);

  if (result.error) {
    return { ok: false, message: result.error.message };
  }

  revalidateDashboards();
  return { ok: true, message: `Profile marked ${status}.` };
}
