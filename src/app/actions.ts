"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  APPROVAL_SUPERVISOR_EMAIL,
  CODE_RED_BLUE_PROGRAM,
  FIXED_EMERGENCY_PAY_RATE,
  FIXED_STANDARD_PAY_RATE,
  PROGRAMS,
  KNOWN_PROGRAMS,
  normalizeAssignedProgramNames,
  LOCATIONS,
  SKILLS,
  ROLE_DASHBOARD_PATHS,
  canUseShiftExchange
} from "@/shared/lib/constants";
import { isSupabaseConfigured } from "@/shared/lib/supabase/env";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { createSupabaseAdminClient, hasSupabaseServiceRoleKey } from "@/shared/lib/supabase/admin";
import { getPasswordRequirementMessage } from "@/shared/lib/password";
import { formatTimeRange, todayEasternISO } from "@/shared/lib/dates";
import { escapeEmailHtml, sendDecisionEmail, sendSubmissionEmail } from "@/shared/lib/decision-email";
import {
  createCodeRedShift,
  getCodeRedAvailabilityDates,
  getCodeRedCoverageOption,
  getCodeRedTemplateFromSlug,
  getCodeRedTemplateFromTitle,
  getCodeRedWeekDates,
  isCodeRedShift
} from "@/shared/lib/shift-templates";
import type {
  AutomatedMessageEvent,
  AppRole,
  LocationName,
  ProgramName,
  ProfileStatus,
  RequestStatus,
  ShiftPost,
  SkillName
} from "@/shared/types/domain";

type ActionState = {
  ok: boolean;
  message: string;
  redirectTo?: string;
};

const locationSchema = z.enum(LOCATIONS as [LocationName, ...LocationName[]]);
const programSchema = z.enum(KNOWN_PROGRAMS as [ProgramName, ...ProgramName[]]);
const skillSchema = z.enum(SKILLS as [SkillName, ...SkillName[]]);

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid time.");

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.");

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "size" in value &&
    typeof value.size === "number" &&
    value.size > 0 &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function"
  );
}

function uploadExtension(file: File) {
  if (typeof file.name !== "string") {
    return "jpg";
  }

  return file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
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

function ensureProgramNames(programNames: ProgramName[]) {
  return programNames.length > 0 ? programNames : [PROGRAMS[0]];
}

function asAvailability(formData: FormData) {
  const selected = formData
    .getAll("availability")
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());

  if (selected.length > 0) {
    return selected;
  }

  return asString(formData.get("availability"))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asBoolean(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

async function notifyAdminsInApp({
  staffName,
  staffEmail,
  role,
  message
}: {
  staffName: string;
  staffEmail: string;
  role: AppRole;
  message: string;
}) {
  if (!isSupabaseConfigured() || !hasSupabaseServiceRoleKey()) {
    return;
  }

  const adminClient = createSupabaseAdminClient();
  await adminClient.from("notifications").insert({
    user_id: null,
    role: "admin",
    title: "Staff profile ready for review",
    body:
      staffName +
      " (" +
      staffEmail +
      ") " +
      message +
      " Open the " +
      role +
      " profile in Admin View."
  });
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

  const { data: accountActive } = await supabase.rpc("current_account_active");

  if (accountActive === false) {
    throw new Error("This account has been deleted.");
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (appUser?.deleted_at) {
    throw new Error("This account has been deleted.");
  }

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
    return normalizeAssignedProgramNames(programNames);
  }

  return data?.program_name ? normalizeAssignedProgramNames([data.program_name]) : [];
}

type ActionUser = Awaited<ReturnType<typeof getUserForAction>>;

type AdminScope = {
  isApproved: boolean;
  isSuperAdmin: boolean;
  programNames: ProgramName[];
};

type SupervisorScope = {
  isApproved: boolean;
  programNames: ProgramName[];
};

function normalizeProgramNames(value: unknown) {
  return Array.isArray(value)
    ? normalizeAssignedProgramNames(value.filter((programName): programName is string =>
        typeof programName === "string"
      ))
    : [];
}

async function getAdminScopeForAction(userId: string): Promise<AdminScope> {
  if (!isSupabaseConfigured()) {
    return { isApproved: true, isSuperAdmin: true, programNames: PROGRAMS };
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("admin_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const profile = data as
    | { status?: unknown; is_super_admin?: unknown; program_names?: unknown }
    | null;

  return {
    isApproved: profile?.status === "approved",
    isSuperAdmin: profile?.is_super_admin === true,
    programNames: normalizeProgramNames(profile?.program_names)
  };
}

async function getSupervisorScopeForAction(userId: string): Promise<SupervisorScope> {
  if (!isSupabaseConfigured()) {
    return {
      isApproved: true,
      programNames: ["Beacon/ Anchor", "Code Red/Code Blue", "Front Desk"]
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("supervisor_profiles")
    .select("status,program_names")
    .eq("user_id", userId)
    .maybeSingle();
  const profile = data as
    | { status?: unknown; program_names?: unknown }
    | null;

  return {
    isApproved: profile?.status === "approved",
    programNames: normalizeProgramNames(profile?.program_names)
  };
}

async function isSuperAdminForAction(user: ActionUser) {
  if (user.role !== "admin") {
    return false;
  }

  const scope = await getAdminScopeForAction(user.id);
  return scope.isApproved && scope.isSuperAdmin;
}

async function scopedProgramAccessError(
  user: ActionUser,
  programNames: ProgramName[],
  action: string,
  options: { requireAll?: boolean } = {}
): Promise<ActionState | null> {
  if (user.role === "supervisor") {
    const scope = await getSupervisorScopeForAction(user.id);
    const allowedPrograms = new Set(scope.programNames);
    const hasAccess = (options.requireAll ?? true)
      ? programNames.every((programName) => allowedPrograms.has(programName))
      : programNames.some((programName) => allowedPrograms.has(programName));

    if (scope.isApproved && programNames.length > 0 && hasAccess) {
      return null;
    }

    return {
      ok: false,
      message: "You can only " + action + " for programs assigned to your supervisor profile."
    };
  }

  if (user.role !== "admin") {
    return { ok: false, message: "Only supervisors and admins can " + action + "." };
  }

  const scope = await getAdminScopeForAction(user.id);

  if (scope.isSuperAdmin) {
    return null;
  }

  const allowedPrograms = new Set(scope.programNames);
  const hasAccess = (options.requireAll ?? true)
    ? programNames.every((programName) => allowedPrograms.has(programName))
    : programNames.some((programName) => allowedPrograms.has(programName));

  if (programNames.length > 0 && hasAccess) {
    return null;
  }

  return {
    ok: false,
    message: "You can only " + action + " for programs assigned to your admin profile."
  };
}

function escapeTemplateValue(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderAutomatedMessageTemplate(
  template: string,
  values: Record<string, string>,
  multilineSummary = false
) {
  return Object.entries(values).reduce(
    (current, [key, value]) =>
      current.replaceAll(
        "{{" + key + "}}",
        multilineSummary && key === "request_summary"
          ? escapeTemplateValue(value).replace(/\r?\n/g, "<br>")
          : escapeTemplateValue(value)
      ),
    template
  );
}

function renderRequestSummaryHtml(summary: string) {
  return escapeEmailHtml(summary).replace(/\r?\n/g, "<br>");
}

function sanitizeRichText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son[a-z]+=("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

function formatDateForEmail(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : value;
}

async function sendRequestSubmissionConfirmation({
  user,
  requestId,
  requestKind,
  programName,
  submittedAt,
  requestSummary
}: {
  user: ActionUser;
  requestId: string;
  requestKind: "time off" | "shift coverage";
  programName: ProgramName;
  submittedAt: string;
  requestSummary: string;
}) {
  if (!user.email) return "Confirmation email could not be sent because your account has no email address.";

  try {
    const emailClient = hasSupabaseServiceRoleKey()
      ? createSupabaseAdminClient()
      : await createSupabaseServerClient();
    const { data: templates } = await emailClient
      .from("automated_message_templates")
      .select("*")
      .eq("event_type", "request_submitted")
      .eq("active", true);
    const selectedTemplate = (templates ?? [])
      .filter((template) => {
        const programs = normalizeProgramNames(template.program_names);
        return programs.length === 0 || programs.includes(programName);
      })
      .sort((first, second) => {
        const firstPrograms = normalizeProgramNames(first.program_names);
        const secondPrograms = normalizeProgramNames(second.program_names);
        if (firstPrograms.length === 0 && secondPrograms.length === 0) {
          return second.updated_at.localeCompare(first.updated_at);
        }
        if (firstPrograms.length === 0) return 1;
        if (secondPrograms.length === 0) return -1;
        return firstPrograms.length - secondPrograms.length ||
          second.updated_at.localeCompare(first.updated_at);
      })[0];

    const submittedAtParts = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
      timeZoneName: "short"
    }).formatToParts(new Date(submittedAt));
    const submittedAtPart = (type: Intl.DateTimeFormatPartTypes) =>
      submittedAtParts.find((part) => part.type === type)?.value ?? "";
    const submittedAtLabel = `${submittedAtPart("month")}/${submittedAtPart("day")}/${submittedAtPart("year")} at ${submittedAtPart("hour")}:${submittedAtPart("minute")} ${submittedAtPart("dayPeriod")} ${submittedAtPart("timeZoneName")}`;
    const values = {
      employee_name: user.full_name,
      request_kind: requestKind,
      program_name: programName,
      submitted_at: submittedAtLabel,
      request_summary: requestSummary,
      status: "submitted"
    };
    const subject = selectedTemplate
      ? renderAutomatedMessageTemplate(selectedTemplate.subject, values)
      : "Your Request Has Been Submitted";
    const templateBody = selectedTemplate
      ? sanitizeRichText(renderAutomatedMessageTemplate(selectedTemplate.body_html, values, true))
      : `<p>Hello ${escapeEmailHtml(user.full_name)},</p><p>Your ${escapeEmailHtml(requestKind)} request was successfully submitted on <strong>${escapeEmailHtml(submittedAtLabel)}</strong>.</p><p><strong>Request Summary</strong><br>${renderRequestSummaryHtml(requestSummary)}</p><p>Your request is awaiting review. We will email you when a decision is made.</p>`;
    const bodyHtml = templateBody + (selectedTemplate && !selectedTemplate.body_html.includes("{{submitted_at}}")
      ? `<p><strong>Submitted:</strong> ${escapeEmailHtml(submittedAtLabel)}</p>`
      : "") + (selectedTemplate && !selectedTemplate.body_html.includes("{{request_summary}}")
      ? `<p><strong>Request Summary</strong><br>${renderRequestSummaryHtml(requestSummary)}</p>`
      : "");

    const sent = await sendSubmissionEmail({
      to: user.email,
      subject,
      bodyHtml,
      idempotencyKey: `request-submitted/${requestKind === "time off" ? "time-off" : "shift"}/${requestId}`
    });

    if (hasSupabaseServiceRoleKey()) {
      await emailClient.from("automated_email_deliveries").insert({
        template_id: selectedTemplate?.id ?? null,
        request_id: requestKind === "time off" ? requestId : null,
        event_type: "request_submitted",
        program_name: programName,
        recipient_user_id: user.id,
        recipient_email: user.email,
        recipient_name: user.full_name,
        subject,
        body_html: bodyHtml,
        status: sent.ok ? "sent" : "failed",
        sent_at: sent.ok ? new Date().toISOString() : null,
        error_message: sent.error ?? null,
        metadata: { requestKind, requestId, submittedAt, requestSummary }
      });
    }

    return sent.ok
      ? "A confirmation email was sent to your Bright Harbor address."
      : `Your request was saved, but the confirmation email could not be sent: ${sent.error}`;
  } catch (error) {
    return "Your request was saved, but the confirmation email could not be sent: " +
      (error instanceof Error ? error.message : "email service unavailable.");
  }
}

async function sendAutomatedTimeOffEmail({
  supabase,
  request,
  status,
  reviewComment,
  reviewerName
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  request: {
    id: string;
    user_id: string;
    employee_name: string;
    program_name: string;
    start_date: string;
    end_date: string;
    reason: string;
  };
  status: "approved" | "declined";
  reviewComment: string;
  reviewerName: string;
}) {
  const eventType: AutomatedMessageEvent =
    status === "approved" ? "time_off_approved" : "time_off_declined";
  const { data: templates, error: templateError } = await supabase
    .from("automated_message_templates")
    .select("*")
    .eq("event_type", eventType)
    .eq("active", true);

  // A missing or disabled custom template must not suppress the decision email.

  const matchingTemplates = (templates ?? []).filter((template) => {
    const programNames = normalizeProgramNames(template.program_names);
    return programNames.length === 0 || programNames.includes(request.program_name as ProgramName);
  });
  const selectedTemplate = matchingTemplates.sort((first, second) => {
    const firstSpecificity = normalizeProgramNames(first.program_names).length;
    const secondSpecificity = normalizeProgramNames(second.program_names).length;
    return secondSpecificity - firstSpecificity;
  })[0];

  const { data: recipient } = await supabase
    .from("users")
    .select("email,full_name")
    .eq("id", request.user_id)
    .maybeSingle();

  const recipientEmail = recipient?.email ?? "";

  if (!recipientEmail) {
    return "Employee email is missing; the decision email was not sent.";
  }

  const values = {
    employee_name: request.employee_name,
    program_name: request.program_name as ProgramName,
    start_date: request.start_date,
    end_date: request.end_date,
    reason: request.reason,
    status,
    review_comment: reviewComment || "No additional comments were added.",
    reviewer_name: reviewerName
  };
  const subject = selectedTemplate
    ? renderAutomatedMessageTemplate(selectedTemplate.subject, values)
    : undefined;
  const bodyHtml = selectedTemplate
    ? sanitizeRichText(renderAutomatedMessageTemplate(selectedTemplate.body_html, values))
    : undefined;
  const sent = await sendDecisionEmail({
    to: recipientEmail,
    employeeName: request.employee_name,
    requestKind: "time off",
    programName: request.program_name,
    dateDescription: `${request.start_date} through ${request.end_date}`,
    status,
    reviewComment,
    reviewerName,
    subject,
    customBodyHtml: bodyHtml,
    commentAlreadyInBody: selectedTemplate?.body_html.includes("{{review_comment}}") ?? false,
    idempotencyKey: `time-off-decision/${request.id}/${status}`
  });
  if (templateError) {
    return sent.ok ? "Decision email sent; template history is unavailable." : `Decision email failed: ${sent.error}`;
  }

  const { error } = await supabase.from("automated_email_deliveries").insert({
    template_id: selectedTemplate?.id ?? null,
    request_id: request.id,
    event_type: eventType,
    program_name: request.program_name as ProgramName,
    recipient_user_id: request.user_id,
    recipient_email: recipientEmail,
    recipient_name: recipient?.full_name ?? request.employee_name,
    subject: subject ?? `Your time off request was ${status === "approved" ? "approved" : "denied"}`,
    body_html: bodyHtml ?? `Your time off request was ${status}. Comment: ${reviewComment || "No additional comment was added."}`,
    status: sent.ok ? "sent" : "failed",
    sent_at: sent.ok ? new Date().toISOString() : null,
    error_message: sent.error ?? null,
    metadata: {
      reviewComment,
      reviewerName
    }
  });

  if (!sent.ok) return `Decision email failed: ${sent.error}`;
  return error ? "Decision email sent, but delivery history could not be saved." : `Decision email sent to ${recipientEmail}.`;
}

function revalidateDashboards() {
  revalidatePath("/");
  revalidatePath("/employee");
  revalidatePath("/supervisor");
  revalidatePath("/admin");
  revalidatePath("/employees");
  revalidatePath("/employees/account-types");
  revalidatePath("/monthly-winners");
  revalidatePath("/reports");
  revalidatePath("/automated-messages");
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

  if (parsed.data.program_name === CODE_RED_BLUE_PROGRAM) {
    return { ok: false, message: "Use Add Shifts to publish Code Red/Code Blue coverage." };
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
      message: "Demo mode: coverage request submitted for program review."
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
    owner_user_id: user.id
  };

  const { data: postedShift, error } = await supabase.from("shift_posts")
    .insert(insert)
    .select("id,created_at")
    .single();

  if (error) {
    return { ok: false, message: error.message };
  }

  const confirmation = await sendRequestSubmissionConfirmation({
    user,
    requestId: postedShift.id,
    requestKind: "shift coverage",
    programName: parsed.data.program_name,
    submittedAt: postedShift.created_at,
    requestSummary: `Program: ${parsed.data.program_name}\nDate: ${formatDateForEmail(parsed.data.shift_date)}\nTime: ${parsed.data.start_time}–${parsed.data.end_time}\nLocation: ${parsed.data.location_name}\nReason: ${parsed.data.details}`
  });

  revalidateDashboards();
  return {
    ok: true,
    message: "Posted for coverage for your program. " + confirmation
  };
}

export async function updateWorkerProfileAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getUserForAction("employee");
  const programNames = asPrograms(formData);
  const skills = asSkills(formData);
  const availability = asAvailability(formData);
  const phone = asString(formData.get("phone"));
  const fullName = asString(formData.get("full_name")) || user.full_name;
  const preferredContact = asString(formData.get("preferred_contact"));
  const pronouns = asString(formData.get("pronouns")).slice(0, 80);
  const manager = asString(formData.get("manager")).slice(0, 160);
  const photo = formData.get("photo");

  if (programNames.length === 0) {
    return { ok: false, message: "Choose at least one program." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: employee profile updated." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("worker_profiles")
    .select("account_information")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingProfileError) {
    return { ok: false, message: existingProfileError.message };
  }

  const storedInformation = existingProfile?.account_information;
  const accountInformation =
    storedInformation && typeof storedInformation === "object" && !Array.isArray(storedInformation)
      ? storedInformation
      : {};
  let photoUrl: string | null = null;

  if (isUploadedFile(photo)) {
    const extension = uploadExtension(photo);
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

  const userUpdate: {
    full_name: string;
    phone: string | null;
    avatar_url?: string;
  } = {
    full_name: fullName,
    phone: phone || null
  };

  if (photoUrl) {
    userUpdate.avatar_url = photoUrl;
  }

  const { error: userUpdateError } = await supabase
    .from("users")
    .update(userUpdate)
    .eq("id", user.id);

  if (userUpdateError) {
    return { ok: false, message: userUpdateError.message };
  }

  const { error } = await supabase.from("worker_profiles").upsert(
    {
      user_id: user.id,
      status: "pending",
      program_name: programNames[0],
      program_names: programNames,
      availability,
      skills,
      account_information: { ...accountInformation, preferredContact, pronouns, manager },
      ...(photoUrl ? { photo_url: photoUrl } : {})
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  await notifyAdminsInApp({
    staffName: fullName,
    staffEmail: user.email,
    role: "employee",
    message: "updated employee profile information for review."
  });

  revalidateDashboards();
  return { ok: true, message: "Employee profile submitted for approval." };
}

export async function createStaffAccountAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentUser = await getUserForAction("admin");
  const parsed = z
    .object({
      full_name: z.string().min(2, "Add the staff member's name."),
      email: z.string().email("Use a valid email address."),
      role: z.enum(["employee", "supervisor", "admin", "admin_supervisor"])
    })
    .safeParse({
      full_name: asString(formData.get("full_name")),
      email: asString(formData.get("email")).toLowerCase(),
      role: asString(formData.get("role"))
    });
  const programNames = asPrograms(formData);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the staff account form." };
  }

  if (!/^[^@\s]+@brightharbor\.org$/.test(parsed.data.email)) {
    return { ok: false, message: "You must use your Bright Harbor Email." };
  }

  if ((parsed.data.role === "employee" || parsed.data.role === "supervisor" || parsed.data.role === "admin_supervisor") && programNames.length === 0) {
    return { ok: false, message: "Choose at least one starting program." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: setup email would be sent." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: approvedAdminProfile } = await supabase
    .from("admin_profiles")
    .select("id")
    .eq("user_id", currentUser.id)
    .eq("status", "approved")
    .maybeSingle();

  if (currentUser.role !== "admin" || !approvedAdminProfile) {
    return { ok: false, message: "Only admins can create staff accounts." };
  }

  if ((parsed.data.role === "supervisor" || parsed.data.role === "admin" || parsed.data.role === "admin_supervisor") && !(await isSuperAdminForAction(currentUser))) {
    return { ok: false, message: "Only super admins can create supervisor or admin accounts." };
  }

  if (parsed.data.role === "employee") {
    const scopeError = await scopedProgramAccessError(
      currentUser,
      programNames,
      "create staff accounts"
    );

    if (scopeError) {
      return scopeError;
    }
  }

  if (!hasSupabaseServiceRoleKey()) {
    return {
      ok: false,
      message: "Add SUPABASE_SERVICE_ROLE_KEY in Netlify to send staff setup emails."
    };
  }

  const adminClient = createSupabaseAdminClient();
  const invitedRole = parsed.data.role === "admin_supervisor" ? "admin" : parsed.data.role;
  const metadata = {
    role: invitedRole,
    full_name: parsed.data.full_name,
    program_name:
      parsed.data.role === "employee" || parsed.data.role === "supervisor" || parsed.data.role === "admin_supervisor"
        ? programNames[0]
        : undefined,
    program_names:
      parsed.data.role === "employee" || parsed.data.role === "supervisor" || parsed.data.role === "admin_supervisor"
        ? programNames
        : undefined,
    dual_reviewer: parsed.data.role === "admin_supervisor",
    invited_by: currentUser.id,
    invited_by_email: currentUser.email,
    setup_required: true
  };
  const invite = await adminClient.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: appBaseUrl() + "/auth/callback?next=/auth/setup",
    data: metadata
  });

  if (invite.error) {
    return { ok: false, message: invite.error.message };
  }

  const invitedUser = invite.data.user;
  if (!invitedUser) {
    return { ok: false, message: "The invitation did not return a staff account. Please try again." };
  }

  const { error: userRecordError } = await adminClient.from("users").upsert({
    id: invitedUser.id,
    email: parsed.data.email,
    full_name: parsed.data.full_name,
    role: invitedRole
  });

  if (userRecordError) {
    return { ok: false, message: "Setup email sent, but the account record could not be saved: " + userRecordError.message };
  }

  if (parsed.data.role === "employee") {
    const { error: workerProfileError } = await adminClient.from("worker_profiles").upsert(
      {
        user_id: invitedUser.id,
        status: "pending",
        program_name: programNames[0],
        program_names: programNames,
        account_information: {
          invitedBy: currentUser.id,
          setupRequired: "true"
        }
      },
      { onConflict: "user_id" }
    );

    if (workerProfileError) {
      return { ok: false, message: "Setup email sent, but the employee profile could not be saved: " + workerProfileError.message };
    }
  } else if (parsed.data.role === "supervisor") {
    const { error: supervisorProfileError } = await adminClient.from("supervisor_profiles").upsert(
      {
        user_id: invitedUser.id,
        status: "pending",
        program_names: programNames
      },
      { onConflict: "user_id" }
    );

    if (supervisorProfileError) {
      return { ok: false, message: "Setup email sent, but the supervisor profile could not be saved: " + supervisorProfileError.message };
    }
  } else {
    const { error: adminProfileError } = await adminClient.from("admin_profiles").upsert(
      {
        user_id: invitedUser.id,
        status: "pending",
        program_names: [],
        is_super_admin: false
      },
      { onConflict: "user_id" }
    );

    if (adminProfileError) {
      return { ok: false, message: adminProfileError.message };
    }

    if (parsed.data.role === "admin_supervisor") {
      const { error: supervisorProfileError } = await adminClient.from("supervisor_profiles").upsert(
        {
          user_id: invitedUser.id,
          status: "pending",
          program_names: programNames
        },
        { onConflict: "user_id" }
      );

      if (supervisorProfileError) {
        return { ok: false, message: "Setup email sent, but the supervisor profile could not be saved: " + supervisorProfileError.message };
      }
    }
  }

  revalidateDashboards();
  return { ok: true, message: "Setup email sent to " + parsed.data.email + "." };
}

export async function updateAccountTypeAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentUser = await getUserForAction("admin");
  const parsed = z
    .object({
      user_id: z.string().min(1, "Choose a valid staff account."),
      account_type: z.enum(["employee", "supervisor", "admin", "super_admin"])
    })
    .safeParse({
      user_id: asString(formData.get("user_id")),
      account_type: asString(formData.get("account_type"))
    });
  const programNames = ensureProgramNames(asPrograms(formData));
  const primaryProgram = programNames[0] ?? "Front Desk";

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Choose a valid account type."
    };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: account type would be updated." };
  }

  if (!(await isSuperAdminForAction(currentUser))) {
    return { ok: false, message: "Only super admins can update account types." };
  }

  if (!hasSupabaseServiceRoleKey()) {
    return {
      ok: false,
      message: "Add SUPABASE_SERVICE_ROLE_KEY in Netlify to update account types."
    };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: targetUser, error: targetUserError } = await adminClient
    .from("users")
    .select("role,account_type_changed_at")
    .eq("id", parsed.data.user_id)
    .single();

  if (targetUserError || !targetUser) {
    return { ok: false, message: targetUserError?.message ?? "Staff account not found." };
  }

  const { data: existingAdminProfile } = await adminClient
    .from("admin_profiles")
    .select("is_super_admin")
    .eq("user_id", parsed.data.user_id)
    .maybeSingle();

  if (existingAdminProfile?.is_super_admin) {
    return {
      ok: false,
      message: "Super admin account types cannot be changed from this page."
    };
  }

  if (targetUser.role === parsed.data.account_type) {
    return { ok: true, message: "Account type is already up to date." };
  }

  if (parsed.data.account_type === "employee") {
    const { error } = await adminClient.from("worker_profiles").upsert(
      {
        user_id: parsed.data.user_id,
        status: "approved",
        program_name: primaryProgram,
        program_names: programNames
      },
      { onConflict: "user_id" }
    );

    if (error) {
      return { ok: false, message: error.message };
    }

    await adminClient
      .from("supervisor_profiles")
      .update({ status: "suspended" })
      .eq("user_id", parsed.data.user_id);
    await adminClient
      .from("admin_profiles")
      .update({ status: "suspended", is_super_admin: false })
      .eq("user_id", parsed.data.user_id);
  }

  if (parsed.data.account_type === "supervisor") {
    const { error } = await adminClient.from("supervisor_profiles").upsert(
      {
        user_id: parsed.data.user_id,
        status: "approved",
        program_names: programNames
      },
      { onConflict: "user_id" }
    );

    if (error) {
      return { ok: false, message: error.message };
    }

    await adminClient
      .from("admin_profiles")
      .update({ status: "suspended", is_super_admin: false })
      .eq("user_id", parsed.data.user_id);
  }

  if (parsed.data.account_type === "admin" || parsed.data.account_type === "super_admin") {
    const { error } = await adminClient.from("admin_profiles").upsert(
      {
        user_id: parsed.data.user_id,
        status: "approved",
        program_names: programNames,
        is_super_admin: parsed.data.account_type === "super_admin"
      },
      { onConflict: "user_id" }
    );

    if (error) {
      return { ok: false, message: error.message };
    }
  }

  const { error: userError } = await adminClient
    .from("users")
    .update({
      role: parsed.data.account_type === "super_admin" ? "admin" : parsed.data.account_type,
      account_type_changed_at: new Date().toISOString()
    })
    .eq("id", parsed.data.user_id);

  if (userError) {
    return { ok: false, message: userError.message };
  }

  revalidateDashboards();
  return { ok: true, message: "Account type updated." };
}

export async function deleteEmployeeAccountAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentUser = await getUserForAction("admin");
  const parsed = z.object({
    user_id: z.string().uuid(),
    confirmation_email: z.string().email()
  }).safeParse({
    user_id: asString(formData.get("user_id")),
    confirmation_email: asString(formData.get("confirmation_email")).toLowerCase()
  });

  if (!parsed.success) {
    return { ok: false, message: "Enter the employee’s email address to confirm deletion." };
  }

  if (parsed.data.user_id === currentUser.id) {
    return { ok: false, message: "You cannot delete your own account." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: employee account would be deleted." };
  }

  if (!(await isSuperAdminForAction(currentUser))) {
    return { ok: false, message: "Only super admins can delete employee accounts." };
  }

  if (!hasSupabaseServiceRoleKey()) {
    return { ok: false, message: "The service role key is required to delete an employee account." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: employee, error: lookupError } = await adminClient
    .from("users")
    .select("id,email,role,deleted_at")
    .eq("id", parsed.data.user_id)
    .maybeSingle();

  if (lookupError || !employee || employee.deleted_at) {
    return { ok: false, message: "This active employee account could not be found." };
  }

  if (employee.role !== "employee") {
    return { ok: false, message: "Only employee accounts can be deleted here." };
  }

  if (employee.email.toLowerCase() !== parsed.data.confirmation_email) {
    return { ok: false, message: "The email address does not match this employee account." };
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(employee.id, true);

  if (deleteError) {
    return { ok: false, message: "Could not delete the employee account: " + deleteError.message };
  }

  const { error: archiveError } = await adminClient
    .from("users")
    .update({
      deleted_at: new Date().toISOString(),
      email: `deleted-${employee.id}@deleted.brightharbor.invalid`,
      full_name: "Deleted employee",
      phone: null,
      avatar_url: null
    })
    .eq("id", employee.id);

  if (archiveError) {
    return { ok: false, message: "Sign-in access was removed, but the employee could not be hidden from active lists: " + archiveError.message };
  }

  const { error: profileError } = await adminClient
    .from("worker_profiles")
    .update({ status: "suspended", photo_url: null })
    .eq("user_id", employee.id);

  if (profileError) {
    return { ok: false, message: "The account was deleted, but the employee profile could not be suspended: " + profileError.message };
  }

  revalidateDashboards();
  return { ok: true, message: "Employee account deleted. Staffing history was retained." };
}

export async function updateStaffProgramsAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const currentUser = await getUserForAction("admin");
  const parsed = z
    .object({
      user_id: z.string().min(1, "Choose a valid staff account.")
    })
    .safeParse({
      user_id: asString(formData.get("user_id"))
    });
  const programNames = [...new Set(asPrograms(formData))];
  const primaryProgram = programNames[0] ?? "Front Desk";

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Choose a valid staff account."
    };
  }

  if (programNames.length === 0) {
    return { ok: false, message: "Choose at least one program." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: programs would be updated." };
  }

  if (currentUser.role !== "admin") {
    return { ok: false, message: "Only admins can update staff programs." };
  }

  const adminScope = await getAdminScopeForAction(currentUser.id);
  if (!adminScope.isApproved) {
    return { ok: false, message: "An approved admin account is required to update programs." };
  }
  const allowedPrograms = new Set(adminScope.programNames);

  if (
    !adminScope.isSuperAdmin &&
    !programNames.every((programName) => allowedPrograms.has(programName))
  ) {
    return {
      ok: false,
      message: "You can only assign programs in your admin scope."
    };
  }

  if (!hasSupabaseServiceRoleKey()) {
    return {
      ok: false,
      message: "Add SUPABASE_SERVICE_ROLE_KEY in Netlify to update staff programs."
    };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: targetUser, error: targetUserError } = await adminClient
    .from("users")
    .select("id,role")
    .eq("id", parsed.data.user_id)
    .single();

  if (targetUserError || !targetUser) {
    return { ok: false, message: targetUserError?.message ?? "Staff account not found." };
  }

  const targetRole = targetUser.role as AppRole;
  if (targetRole !== "employee") {
    return { ok: false, message: "Only employee programs can be updated here." };
  }
  const { data: existingAdminProfile } = await adminClient
    .from("admin_profiles")
    .select("is_super_admin")
    .eq("user_id", parsed.data.user_id)
    .maybeSingle();

  if (existingAdminProfile?.is_super_admin) {
    return { ok: false, message: "Super admin program access is protected." };
  }

  let updatedProgramNames = programNames;

  if (!adminScope.isSuperAdmin) {
    const { data: workerProfile } = await adminClient
      .from("worker_profiles")
      .select("program_name,program_names")
      .eq("user_id", parsed.data.user_id)
      .maybeSingle();
    const existingProgramNames = normalizeProgramNames(workerProfile?.program_names).length
      ? normalizeProgramNames(workerProfile?.program_names)
      : workerProfile?.program_name
        ? [workerProfile.program_name as ProgramName]
        : [];

    if (!existingProgramNames.some((programName) => allowedPrograms.has(programName))) {
      return {
        ok: false,
        message: "You can only update employees currently in your admin scope."
      };
    }

    updatedProgramNames = [
      ...programNames,
      ...existingProgramNames.filter((programName) => !allowedPrograms.has(programName))
    ];
  }

  const { error } = await adminClient.from("worker_profiles").upsert(
    {
      user_id: parsed.data.user_id,
      program_name: primaryProgram,
      program_names: updatedProgramNames
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateDashboards();
  return { ok: true, message: "Programs updated." };
}

export async function completeStaffSetupAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getUserForAction();
  const password = asString(formData.get("password"));
  const confirmPassword = asString(formData.get("confirm_password"));
  const fullName = asString(formData.get("full_name"));
  const phone = asString(formData.get("phone"));
  const role = user.role;
  const programNames = asPrograms(formData);

  if (fullName.length < 2) {
    return { ok: false, message: "Add your full name." };
  }

  const passwordRequirementMessage = getPasswordRequirementMessage(password);

  if (passwordRequirementMessage) {
    return { ok: false, message: passwordRequirementMessage };
  }

  if (password !== confirmPassword) {
    return { ok: false, message: "Passwords do not match." };
  }

  if (programNames.length === 0) {
    return { ok: false, message: role === "admin" ? "Choose at least one division or program." : "Choose at least one program." };
  }

  if (role === "admin" && !hasSupabaseServiceRoleKey() && isSupabaseConfigured()) {
    return { ok: false, message: "Admin account setup is unavailable until the service role key is configured." };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      message: "Demo mode: account setup completed.",
      redirectTo: ROLE_DASHBOARD_PATHS[role]
    };
  }

  if (role === "admin") {
    const adminClient = createSupabaseAdminClient();
    const { data: pendingProfile, error: pendingProfileError } = await adminClient
      .from("admin_profiles")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (pendingProfileError || !pendingProfile) {
      return { ok: false, message: "Your admin invitation is not awaiting setup." };
    }

    const { error } = await adminClient
      .from("admin_profiles")
      .update({ program_names: programNames, is_super_admin: false })
      .eq("id", pendingProfile.id)
      .eq("status", "pending");

    if (error) {
      return { ok: false, message: error.message };
    }
  }

  const supabase = await createSupabaseServerClient();
  const { error: authError } = await supabase.auth.updateUser({
    password,
    data: {
      full_name: fullName,
      setup_completed_at: new Date().toISOString()
    }
  });

  if (authError) {
    return { ok: false, message: authError.message };
  }

  const { error: userError } = await supabase
    .from("users")
    .update({
      full_name: fullName,
      phone: phone || null
    })
    .eq("id", user.id);

  if (userError) {
    return { ok: false, message: userError.message };
  }

  if (role === "employee") {
    const skills = asSkills(formData);
    const availability = asAvailability(formData);
    const preferredContact = asString(formData.get("preferred_contact"));

    const { error } = await supabase.from("worker_profiles").upsert(
      {
        user_id: user.id,
        status: "pending",
        program_name: programNames[0],
        program_names: programNames,
        availability,
        skills,
        account_information: {
          preferredContact,
          setupCompletedAt: new Date().toISOString()
        }
      },
      { onConflict: "user_id" }
    );

    if (error) {
      return { ok: false, message: error.message };
    }
  } else if (role === "supervisor") {
    const { error } = await supabase.from("supervisor_profiles").upsert(
      {
        user_id: user.id,
        status: "pending",
        program_names: programNames,
        location_name: asString(formData.get("location_name")) || null,
        front_desk_location_name: asString(formData.get("front_desk_location_name")) || null,
        title: asString(formData.get("title")) || null
      },
      { onConflict: "user_id" }
    );

    if (error) {
      return { ok: false, message: error.message };
    }
  }

  await notifyAdminsInApp({
    staffName: fullName,
    staffEmail: user.email,
    role,
    message: "completed account setup and submitted profile information for review."
  });

  revalidateDashboards();
  return {
    ok: true,
    message: role === "admin" ? "Account setup complete. A super admin will review your access." : "Account setup complete. Administrators have been notified.",
    redirectTo: ROLE_DASHBOARD_PATHS[role]
  };
}
export async function updateSupervisorProfileAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getUserForAction("supervisor");
  const programNames = asPrograms(formData);
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

  if (programNames.length === 0) {
    return { ok: false, message: "Choose at least one assigned program." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: supervisor profile updated." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("supervisor_profiles").upsert(
    {
      user_id: user.id,
      status: "pending",
      program_names: programNames,
      ...parsed.data
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  await notifyAdminsInApp({
    staffName: user.full_name,
    staffEmail: user.email,
    role: "supervisor",
    message: "updated supervisor profile information for review."
  });

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

  if (parsed.data.program_name === CODE_RED_BLUE_PROGRAM) {
    return { ok: false, message: "Use Add Shifts to publish Code Red/Code Blue coverage." };
  }

  const user = await getUserForAction(role === "admin" ? "admin" : "supervisor");

  if (user.role !== "supervisor") {
    return { ok: false, message: "Admins review team shift requests instead of posting their own shifts." };
  }

  const scopeError = await scopedProgramAccessError(
    user,
    [parsed.data.program_name],
    "post shifts"
  );

  if (scopeError) {
    return scopeError;
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
    owner_user_id: null
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateDashboards();
  return { ok: true, message: "Shift posting is live." };
}

export async function addCodeRedShiftsAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const shiftDate = asString(formData.get("shift_date"));
  const slugs = [...new Set(formData.getAll("template_slugs").map(asString))];
  const templates = slugs.map((slug) => getCodeRedTemplateFromSlug(slug));

  if (!dateSchema.safeParse(shiftDate).success ||
      !Number.isFinite(Date.parse(`${shiftDate}T12:00:00Z`)) ||
      new Date(`${shiftDate}T12:00:00Z`).toISOString().slice(0, 10) !== shiftDate ||
      shiftDate < todayEasternISO()) {
    return { ok: false, message: "Choose today or a future date." };
  }

  if (templates.length === 0 || templates.some((template) => !template)) {
    return { ok: false, message: "Choose at least one valid shift." };
  }

  const user = await getUserForAction("supervisor");
  if (user.role !== "supervisor") {
    return { ok: false, message: "Only the Code Red/Code Blue supervisor can add these shifts." };
  }

  const scopeError = await scopedProgramAccessError(user, [CODE_RED_BLUE_PROGRAM], "add Code Red/Code Blue shifts");
  if (scopeError) return scopeError;

  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Connect Supabase to publish Code Red/Code Blue shifts." };
  }

  const supabase = await createSupabaseServerClient();
  const shifts = templates.map((template) => createCodeRedShift(shiftDate, template!, user.id));
  const { error } = await supabase.from("shift_posts").upsert(shifts, {
    onConflict: "id",
    ignoreDuplicates: true
  });

  if (error) return { ok: false, message: error.message };

  revalidateDashboards();
  return { ok: true, message: "Selected shifts are available for staff to request." };
}

export async function requestShiftAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const shiftId = asString(formData.get("shift_id"));
  const note = asString(formData.get("note"));
  const requestScope = asString(formData.get("request_scope")) || "single";
  const coverage = getCodeRedCoverageOption(asString(formData.get("coverage_option")));
  const availabilityDates = formData
    .getAll("availability_dates")
    .filter((value): value is string => dateSchema.safeParse(value).success);
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
      message: "Demo mode: request submitted to your program reviewers."
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: shiftData } = await supabase
    .from("shift_posts")
    .select("*")
    .eq("id", shiftId)
    .single();
  const shift = (shiftData ?? null) as ShiftPost | null;

  if (!shift || !programNames.includes(shift.program_name as ProgramName)) {
    return { ok: false, message: "Choose a shift from one of your programs." };
  }

  if (isCodeRedShift(shift)) {
    const template = getCodeRedTemplateFromTitle(shift.title);

    if (!template) {
      return { ok: false, message: "Choose a valid Code Red/Code Blue shift." };
    }

    const baseDate = shift.shift_date;
    const allowedAvailabilityDates = getCodeRedAvailabilityDates(baseDate);
    const requestDates =
      requestScope === "week"
        ? getCodeRedWeekDates(baseDate)
        : requestScope === "availability"
          ? availabilityDates.filter((date) => allowedAvailabilityDates.includes(date))
          : [baseDate];

    if (requestDates.length === 0) {
      return { ok: false, message: "Choose at least one available date." };
    }

    const { data: matchingShiftData, error: matchingShiftError } = await supabase
      .from("shift_posts")
      .select("*")
      .eq("program_name", CODE_RED_BLUE_PROGRAM)
      .eq("title", template.title)
      .eq("status", "open")
      .in("shift_date", requestDates);

    if (matchingShiftError) return { ok: false, message: matchingShiftError.message };

    const coverageUnits = coverage.value === "full" ? 2 : 1;
    const requestedShifts = ((matchingShiftData ?? []) as ShiftPost[]).filter(
      (item) => item.openings - item.filled_openings >= coverageUnits &&
        (requestScope !== "single" || item.id === shift.id)
    );

    if (requestedShifts.length === 0) {
      return { ok: false, message: "No matching posted shifts have enough coverage available." };
    }
    const scopeLabel =
      requestScope === "week"
        ? "same shift for the week"
        : requestScope === "availability"
          ? "specific availability dates"
          : "this shift";
    const requestNote = [
      "Coverage requested: " + coverage.label + " (" + coverage.detail + ").",
      "Request type: " + scopeLabel + ".",
      note || null
    ]
      .filter(Boolean)
      .join(" ");

    const { data: insertedRequests, error } = await supabase.from("requests").upsert(
      requestedShifts.map((item) => ({
        shift_id: item.id,
        requestor_id: user.id,
        requestor_name: user.full_name,
        note: requestNote,
        status: "pending_supervisor_approval" as const
      })),
      { onConflict: "shift_id,requestor_id", ignoreDuplicates: true }
    ).select("id,shift_id,created_at");

    if (error) {
      return { ok: false, message: error.message };
    }

    if (!insertedRequests?.length) {
      return { ok: false, message: "You have already requested the selected posted shifts." };
    }

    const submittedShiftIds = new Set(insertedRequests.map((request) => request.shift_id));
    const submittedShifts = requestedShifts.filter((item) => submittedShiftIds.has(item.id));
    const confirmation = await sendRequestSubmissionConfirmation({
      user,
      requestId: insertedRequests[0].id,
      requestKind: "shift coverage",
      programName: shift.program_name,
      submittedAt: insertedRequests[0].created_at,
      requestSummary: `Program: ${shift.program_name}\nShift: ${shift.title}\nDates: ${submittedShifts.map((item) => formatDateForEmail(item.shift_date)).join(", ")}\nTime: ${formatTimeRange(shift)}\nCoverage: ${coverage.label}${note ? `\nNote: ${note}` : ""}`
    });

    revalidateDashboards();
    return {
      ok: true,
      message: "Requested " + insertedRequests.length + " posted shift" +
        (insertedRequests.length === 1 ? "" : "s") + ". Sent to assigned program reviewers. " + confirmation
    };
  }

  const { data: submittedRequest, error } = await supabase.from("requests").insert({
    shift_id: shift.id,
    requestor_id: user.id,
    requestor_name: user.full_name,
    note: note || null,
    status: "pending_supervisor_approval"
  }).select("id,created_at").single();

  if (error) {
    return { ok: false, message: error.message };
  }

  const confirmation = await sendRequestSubmissionConfirmation({
    user,
    requestId: submittedRequest.id,
    requestKind: "shift coverage",
    programName: shift.program_name,
    submittedAt: submittedRequest.created_at,
    requestSummary: `Program: ${shift.program_name}\nShift: ${shift.title}\nDate: ${formatDateForEmail(shift.shift_date)}\nTime: ${formatTimeRange(shift)}\nLocation: ${shift.location_name}${note ? `\nNote: ${note}` : ""}`
  });

  revalidateDashboards();
  return { ok: true, message: "Request sent to assigned program reviewers. " + confirmation };
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
  const { data: shiftData } = await supabase
    .from("shift_posts")
    .select("*")
    .eq("id", shiftId)
    .single();
  const shift = (shiftData ?? null) as ShiftPost | null;

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
  const { data: submittedRequest, error } = await supabase.from("time_off_requests").insert({
    user_id: user.id,
    employee_name: user.full_name,
    ...parsed.data,
    status: "pending_supervisor_approval"
  }).select("id,created_at").single();

  if (error) {
    return { ok: false, message: error.message };
  }

  const confirmation = await sendRequestSubmissionConfirmation({
    user,
    requestId: submittedRequest.id,
    requestKind: "time off",
    programName: parsed.data.program_name,
    submittedAt: submittedRequest.created_at,
    requestSummary: `Program: ${parsed.data.program_name}\nDates: ${formatDateForEmail(parsed.data.start_date)} - ${formatDateForEmail(parsed.data.end_date)}\nReason: ${parsed.data.reason}`
  });

  revalidateDashboards();
  return { ok: true, message: "Time off request sent to your program reviewers. " + confirmation };
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

  const scopeError = await scopedProgramAccessError(
    user,
    [parsed.data.program_name],
    "add OOO days"
  );

  if (scopeError) {
    return scopeError;
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
  const { data: requestToReview } = await supabase
    .from("time_off_requests")
    .select("id,user_id,employee_name,program_name,start_date,end_date,reason")
    .eq("id", requestId)
    .single();

  if (!requestToReview) {
    return { ok: false, message: "Time off request not found." };
  }

  const scopeError = await scopedProgramAccessError(
    user,
    [requestToReview.program_name as ProgramName],
    "review time off requests"
  );

  if (scopeError) {
    return scopeError;
  }

  const { data: updatedRequests, error } = await supabase
    .from("time_off_requests")
    .update({
      status: status as "approved" | "declined" | "cancelled",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_comment: reviewComment || null
    })
    .eq("id", requestId)
    .eq("status", "pending_supervisor_approval")
    .select("id");

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!updatedRequests?.length) {
    return { ok: false, message: "This request has already been reviewed. Refresh the queue." };
  }

  const emailMessage =
    status === "approved" || status === "declined"
      ? await sendAutomatedTimeOffEmail({
          supabase,
          request: requestToReview,
          status,
          reviewComment,
          reviewerName: user.full_name
        })
      : null;

  revalidateDashboards();
  return {
    ok: !emailMessage?.toLowerCase().includes("email failed") && !emailMessage?.includes("not sent"),
    message: `Time off request ${status}.${emailMessage ? " " + emailMessage : ""}`
  };
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
  const { data: shift } = await supabase
    .from("shift_posts")
    .select("title,shift_date,program_name,openings,filled_openings")
    .eq("id", shiftId)
    .single();

  const { data: requestToReview } = await supabase
    .from("requests")
    .select("note,requestor_id,requestor_name")
    .eq("id", requestId)
    .single();

  if (!shift) {
    return { ok: false, message: "Shift not found." };
  }

  const scopeError = await scopedProgramAccessError(
    user,
    [shift.program_name as ProgramName],
    "review shift requests"
  );

  if (scopeError) {
    return scopeError;
  }

  const { data: updatedRequests, error } = await supabase
    .from("requests")
    .update({
      status: status as "approved" | "declined" | "cancelled",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_comment: reviewComment || null
    })
    .eq("id", requestId)
    .eq("status", "pending_supervisor_approval")
    .select("id");

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!updatedRequests?.length) {
    return { ok: false, message: "This request has already been reviewed. Refresh the queue." };
  }

  if (status === "approved") {
    const coverageUnits =
      shift.program_name === CODE_RED_BLUE_PROGRAM &&
      typeof requestToReview?.note === "string" &&
      requestToReview.note.includes("Full shift")
        ? 2
        : 1;
    const filled = Math.min(shift.openings, (shift.filled_openings ?? 0) + coverageUnits);
    await supabase
      .from("shift_posts")
      .update({
        filled_openings: filled,
        status: filled >= shift.openings ? "covered" : "open"
      })
      .eq("id", shiftId);
  }

  let emailMessage = "";
  if ((status === "approved" || status === "declined") && requestToReview?.requestor_id) {
    const { data: recipient } = await supabase
      .from("users")
      .select("email")
      .eq("id", requestToReview.requestor_id)
      .maybeSingle();
    if (recipient?.email) {
      const sent = await sendDecisionEmail({
        to: recipient.email,
        employeeName: requestToReview.requestor_name,
        requestKind: "shift coverage",
        programName: shift.program_name,
        dateDescription: `${shift.title} on ${shift.shift_date}`,
        status,
        reviewComment,
        reviewerName: user.full_name,
        idempotencyKey: `shift-decision/${requestId}/${status}`
      });
      emailMessage = sent.ok ? "Decision email sent." : `Decision email failed: ${sent.error}`;
    } else {
      emailMessage = "Employee email is missing; the decision email was not sent.";
    }
  }

  revalidateDashboards();
  return {
    ok: !emailMessage.toLowerCase().includes("email failed") && !emailMessage.includes("not sent"),
    message: `Request ${status}.${emailMessage ? " " + emailMessage : ""}`
  };
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

export async function saveAutomatedMessageTemplateAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getUserForAction("admin");

  if (!(await isSuperAdminForAction(user))) {
    return { ok: false, message: "Only super admins can manage automated messages." };
  }

  const templateId = asString(formData.get("template_id"));
  const parsed = z
    .object({
      name: z.string().min(3, "Add a message name."),
      event_type: z.enum(["request_submitted", "time_off_approved", "time_off_declined"]),
      subject: z.string().min(4, "Add an email subject."),
      body_html: z.string().min(12, "Add message body text."),
      active: z.boolean()
    })
    .safeParse({
      name: asString(formData.get("name")),
      event_type: asString(formData.get("event_type")),
      subject: asString(formData.get("subject")),
      body_html: sanitizeRichText(asString(formData.get("body_html"))),
      active: asBoolean(formData.get("active"))
    });
  const programNames = asPrograms(formData);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the template." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: "Demo mode: automated message template saved." };
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    name: parsed.data.name,
    event_type: parsed.data.event_type,
    program_names: programNames,
    subject: parsed.data.subject,
    body_html: parsed.data.body_html,
    active: parsed.data.active,
    updated_by: user.id
  };
  const result = templateId
    ? await supabase
        .from("automated_message_templates")
        .update(payload)
        .eq("id", templateId)
    : await supabase.from("automated_message_templates").insert({
        ...payload,
        created_by: user.id
      });

  if (result.error) {
    return { ok: false, message: result.error.message };
  }

  revalidateDashboards();
  return { ok: true, message: "Automated message saved." };
}

export async function moderateProfileAction(
  _previousState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const role = asString(formData.get("profile_role")) as AppRole;
  const profileId = asString(formData.get("profile_id"));
  const status = asString(formData.get("status")) as ProfileStatus;
  const user = await getUserForAction();

  if (!["approved", "suspended", "pending"].includes(status) || !profileId) {
    return { ok: false, message: "Choose a valid profile status." };
  }

  if (!["supervisor", "admin"].includes(user.role)) {
    return { ok: false, message: "Only supervisors and admins can moderate profiles." };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, message: `Demo mode: profile marked ${status}.` };
  }

  const supabase = await createSupabaseServerClient();

  if (role === "admin") {
    if (!(await isSuperAdminForAction(user))) {
      return { ok: false, message: "Only super admins can manage admin access." };
    }

    const adminProgramNames = asPrograms(formData);
    const isSuperAdmin = formData.get("is_super_admin") === "on";

    if (status === "approved" && !isSuperAdmin && adminProgramNames.length === 0) {
      return {
        ok: false,
        message: "Choose at least one program for this admin or mark them as a super admin."
      };
    }

    const { error } = await supabase
      .from("admin_profiles")
      .update({
        status,
        program_names: adminProgramNames,
        is_super_admin: isSuperAdmin
      })
      .eq("id", profileId);

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidateDashboards();
    return { ok: true, message: "Admin access updated." };
  }

  if (role === "supervisor") {
    if (!(await isSuperAdminForAction(user))) {
      return { ok: false, message: "Only super admins can moderate supervisor profiles." };
    }

    const supervisorProgramNames = asPrograms(formData);

    if (status === "approved" && supervisorProgramNames.length === 0) {
      return { ok: false, message: "Choose at least one program for this supervisor." };
    }

    const { error } = await supabase
      .from("supervisor_profiles")
      .update({ status, program_names: supervisorProgramNames })
      .eq("id", profileId);

    if (error) {
      return { ok: false, message: error.message };
    }

    revalidateDashboards();
    return { ok: true, message: `Profile marked ${status}.` };
  }

  const { data: profile } = await supabase
    .from("worker_profiles")
    .select("program_name,program_names")
    .eq("id", profileId)
    .single();

  if (!profile) {
    return { ok: false, message: "Employee profile not found." };
  }

  const profilePrograms = normalizeProgramNames(profile.program_names).length
    ? normalizeProgramNames(profile.program_names)
    : profile.program_name
      ? [profile.program_name as ProgramName]
      : [];
  const scopeError = await scopedProgramAccessError(
    user,
    profilePrograms,
    "moderate employee profiles"
  );

  if (scopeError) {
    return scopeError;
  }

  const profileClient =
    user.role === "supervisor"
      ? hasSupabaseServiceRoleKey()
        ? createSupabaseAdminClient()
        : null
      : supabase;

  if (!profileClient) {
    return {
      ok: false,
      message: "Add SUPABASE_SERVICE_ROLE_KEY in Netlify so supervisors can approve employee profiles."
    };
  }

  const { error } = await profileClient
    .from("worker_profiles")
    .update({ status })
    .eq("id", profileId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateDashboards();
  return { ok: true, message: `Profile marked ${status}.` };
}
