"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { changeTemporaryPasswordAction, completeStaffSetupAction } from "@/app/actions";
import { LOCATIONS, PROGRAMS, SKILLS } from "@/shared/lib/constants";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/browser";
import { isSupabaseConfigured } from "@/shared/lib/supabase/env";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { AvailabilityCheckboxGroup } from "@/shared/components/AvailabilityCheckboxGroup";
import { ProgramScopePicker } from "@/shared/components/ProgramScopePicker";
import { SubmitButton } from "@/shared/components/SubmitButton";
import type { AppRole, ProgramName } from "@/shared/types/domain";

const initialState = { ok: false, message: "", redirectTo: "" };

export function StaffAccountSetupPanel() {
  const router = useRouter();
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const [state, formAction] = useActionState(completeStaffSetupAction, initialState);
  const [passwordState, passwordAction] = useActionState(changeTemporaryPasswordAction, initialState);
  const [loading, setLoading] = useState(configured);
  const [sessionReady, setSessionReady] = useState(!configured);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [role, setRole] = useState<AppRole>("employee");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [programNames, setProgramNames] = useState<ProgramName[]>([]);
  const [accessPreapproved, setAccessPreapproved] = useState(false);
  const [availability, setAvailability] = useState<string[]>([]);

  useEffect(() => {
    if (!configured) {
      return;
    }

    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      const metadata = user?.user_metadata ?? {};
      const { data: appUser } = user
        ? await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
        : { data: null };
      const reviewerRole = appUser?.role === "admin" ? "admin" : appUser?.role === "supervisor" ? "supervisor" : null;
      const { data: reviewerProfile } = user && reviewerRole
        ? await supabase
            .from(reviewerRole === "admin" ? "admin_profiles" : "supervisor_profiles")
            .select("program_names")
            .eq("user_id", user.id)
            .maybeSingle()
        : { data: null };
      const metadataPrograms = Array.isArray(metadata.program_names)
        ? metadata.program_names.filter((program): program is ProgramName => PROGRAMS.includes(program))
        : [];
      const assignedPrograms = Array.isArray(reviewerProfile?.program_names)
        ? reviewerProfile.program_names.filter((program): program is ProgramName => PROGRAMS.includes(program as ProgramName))
        : [];
      const preapprovedPrograms = reviewerRole === "admin"
        ? user?.app_metadata?.staffing_preapproved_admin_programs
        : user?.app_metadata?.staffing_preapproved_supervisor_programs;
      const hasPreapprovedPrograms = Array.isArray(preapprovedPrograms) && preapprovedPrograms.length > 0;

      setSessionReady(Boolean(user));
      setRole(appUser?.role === "admin" ? "admin" : appUser?.role === "supervisor" ? "supervisor" : "employee");
      setFullName(
        typeof metadata.full_name === "string"
          ? metadata.full_name
          : user?.email?.split("@")[0] ?? ""
      );
      setEmail(user?.email ?? "");
      setPasswordChanged(hasPreapprovedPrograms
        ? Boolean(user?.app_metadata?.staffing_setup_password_changed_at)
        : Boolean(metadata.setup_password_changed_at || metadata.signup_password_set_at));
      if (assignedPrograms.length > 0 || metadataPrograms.length > 0) {
        setProgramNames(assignedPrograms.length > 0 ? assignedPrograms : metadataPrograms);
      }
      setAccessPreapproved(hasPreapprovedPrograms);
      if (Array.isArray(metadata.availability)) {
        setAvailability(metadata.availability.filter((item): item is string => typeof item === "string"));
      }
      setLoading(false);
    });
  }, [configured]);

  useEffect(() => {
    if (state.ok && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [router, state.ok, state.redirectTo]);

  if (loading) {
    return (
      <div className="panel mx-auto w-full max-w-2xl p-5 sm:p-6">
        <p className="text-sm text-harbor-midnight/62">Loading account setup...</p>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="panel mx-auto w-full max-w-2xl p-5 sm:p-6">
        <div className="flex gap-3 rounded-lg border border-harbor-sky/20 bg-harbor-mist px-3 py-3 text-sm text-harbor-midnight/70">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-harbor-ocean" aria-hidden="true" />
          <p>Open the setup link from your invitation email. If the link expired, ask an administrator to send a new setup email.</p>
        </div>
      </div>
    );
  }

  if (!passwordChanged && !passwordState.ok) {
    return (
      <div className="panel mx-auto w-full max-w-md p-5 sm:p-6">
        <p className="label">Account setup · Step 1 of 2</p>
        <h1 className="mt-2 text-3xl font-medium text-harbor-midnight">Change your password</h1>
        <p className="mt-2 text-sm leading-6 text-harbor-midnight/70">
          Choose a private password for {email}. Next, you’ll select every program you work in.
        </p>
        <form action={passwordAction} className="mt-6 space-y-4">
          <label className="block">
            <span className="label">New password</span>
            <input name="password" type="password" autoComplete="new-password" className="field mt-1.5" required />
          </label>
          <label className="block">
            <span className="label">Confirm password</span>
            <input name="confirm_password" type="password" autoComplete="new-password" className="field mt-1.5" required />
          </label>
          <ActionFeedback state={passwordState} />
          <SubmitButton className="w-full py-2">
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Save password and continue
          </SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <div className="panel mx-auto w-full max-w-3xl p-5 sm:p-6">
      <div>
        <p className="label">Account setup · Step 2 of 2</p>
        <h1 className="mt-2 text-3xl font-medium text-harbor-midnight">
          Select your programs and verify your profile
        </h1>
        <p className="mt-2 text-sm leading-6 text-harbor-midnight/70">
          {accessPreapproved
            ? "Your listed programs are preapproved. Confirm them to activate access after changing your password. New programs require review."
            : role === "admin"
              ? "Choose the divisions you oversee. A super admin will review your access after setup."
              : "Select every program you work in and confirm your information below. After you submit, administrators will be notified for profile review."}
        </p>
      </div>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="profile_role" value={role} />
        <div className="rounded-xl border border-harbor-sky/20 bg-harbor-mist/60 px-4 py-4">
          <p className="label">Your account</p>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-harbor-midnight/60">Account type</dt>
              <dd className="mt-1 font-semibold text-harbor-midnight">{role === "admin" ? "Admin" : role === "supervisor" ? "Supervisor" : "Employee"}</dd>
            </div>
            <div>
              <dt className="text-harbor-midnight/60">Programs</dt>
              <dd className="mt-1 font-semibold text-harbor-midnight">{programNames.length > 0 ? programNames.join(", ") : "Choose below"}</dd>
            </div>
          </dl>
        </div>
        <label className="block">
          <span className="label">Email</span>
          <input value={email} className="field mt-1.5" disabled />
        </label>

        <label className="block">
          <span className="label">Full name</span>
          <input
            name="full_name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="field mt-1.5"
            required
          />
        </label>

        <label className="block">
          <span className="label">Phone</span>
          <input name="phone" className="field mt-1.5" placeholder="732-555-0100" />
        </label>

        {role === "admin" ? (
          <div>
            <ProgramScopePicker
              selectedProgramNames={programNames}
              onChange={setProgramNames}
              legend="Divisions and programs to oversee"
              compact
            />
            <p className="mt-2 text-xs leading-5 text-harbor-midnight/60">
              Select a division to include every program in it. Programs beyond your preapproved assignment require super admin review.
            </p>
          </div>
        ) : (
          <ProgramScopePicker
            legend={role === "supervisor" ? "Assigned programs" : "Programs"}
            compact
            selectedProgramNames={programNames}
            onChange={setProgramNames}
          />
        )}

        {role === "employee" ? (
          <>
            <AvailabilityCheckboxGroup
              selected={availability}
              onChange={setAvailability}
            />

            <label className="block">
              <span className="label">Preferred contact</span>
              <select name="preferred_contact" className="field mt-1.5">
                <option>Text</option>
                <option>Email</option>
                <option>Phone</option>
              </select>
            </label>

            <fieldset>
              <legend className="label">Skills</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {SKILLS.map((skill) => (
                  <label
                    key={skill}
                    className="flex items-center gap-2 rounded-lg border border-harbor-ocean/10 bg-white px-3 py-2 text-sm text-harbor-midnight/75"
                  >
                    <input
                      name="requirements"
                      type="checkbox"
                      value={skill}
                      className="h-4 w-4 rounded border-harbor-ocean/20 text-harbor-sky"
                    />
                    {skill}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        ) : role === "supervisor" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Title</span>
              <input name="title" className="field mt-1.5" placeholder="Coordinator" />
            </label>
            <label className="block">
              <span className="label">Location</span>
              <select name="location_name" className="field mt-1.5">
                {LOCATIONS.map((location) => (
                  <option key={location} value={location}>{location}</option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="label">Program location profile</span>
              <input
                name="front_desk_location_name"
                className="field mt-1.5"
                placeholder="Front Desk Coordination"
              />
            </label>
          </div>
        ) : null}

        <SubmitButton className="w-full py-2">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Finish account setup
        </SubmitButton>
        <ActionFeedback state={state} />
        {state.ok ? (
          <div className="flex gap-2 rounded-lg border border-harbor-ocean/20 bg-harbor-mist px-3 py-2 text-sm text-harbor-ocean">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>Setup complete. Redirecting...</p>
          </div>
        ) : null}
      </form>
    </div>
  );
}
