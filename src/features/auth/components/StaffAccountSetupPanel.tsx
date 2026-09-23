"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { completeStaffSetupAction } from "@/app/actions";
import { LOCATIONS, PROGRAMS, SKILLS } from "@/shared/lib/constants";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/browser";
import { isSupabaseConfigured } from "@/shared/lib/supabase/env";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
import type { AppRole, ProgramName } from "@/shared/types/domain";

const initialState = { ok: false, message: "", redirectTo: "" };

export function StaffAccountSetupPanel() {
  const router = useRouter();
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const [state, formAction] = useActionState(completeStaffSetupAction, initialState);
  const [loading, setLoading] = useState(configured);
  const [sessionReady, setSessionReady] = useState(!configured);
  const [role, setRole] = useState<AppRole>("employee");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [programNames, setProgramNames] = useState<ProgramName[]>([PROGRAMS[0]]);

  useEffect(() => {
    if (!configured) {
      return;
    }

    const supabase = createSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      const metadata = user?.user_metadata ?? {};
      const metadataPrograms = Array.isArray(metadata.program_names)
        ? metadata.program_names.filter((program): program is ProgramName => PROGRAMS.includes(program))
        : [];

      setSessionReady(Boolean(user));
      setRole(metadata.role === "supervisor" ? "supervisor" : "employee");
      setFullName(
        typeof metadata.full_name === "string"
          ? metadata.full_name
          : user?.email?.split("@")[0] ?? ""
      );
      setEmail(user?.email ?? "");
      if (metadataPrograms.length > 0) {
        setProgramNames(metadataPrograms);
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

  return (
    <div className="panel mx-auto w-full max-w-3xl p-5 sm:p-6">
      <div>
        <p className="label">Account setup</p>
        <h1 className="mt-2 text-3xl font-medium text-harbor-midnight">
          Create your password and verify your profile
        </h1>
        <p className="mt-2 text-sm leading-6 text-harbor-midnight/70">
          Confirm your account information below. After you submit, administrators will be notified for profile review.
        </p>
      </div>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="profile_role" value={role} />
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

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">New password</span>
            <input
              name="password"
              type="password"
              className="field mt-1.5"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />
          </label>
          <label className="block">
            <span className="label">Confirm password</span>
            <input
              name="confirm_password"
              type="password"
              className="field mt-1.5"
              placeholder="Retype password"
              autoComplete="new-password"
              required
            />
          </label>
        </div>

        <label className="block">
          <span className="label">Phone</span>
          <input name="phone" className="field mt-1.5" placeholder="732-555-0100" />
        </label>

        {role === "employee" ? (
          <>
            <fieldset>
              <legend className="label">Programs</legend>
              <div className="mt-2 max-h-60 overflow-auto rounded-lg border border-harbor-ocean/10 bg-white p-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  {PROGRAMS.map((program) => (
                    <label
                      key={program}
                      className="flex items-start gap-2 rounded-md px-2 py-2 text-sm text-harbor-midnight/75 hover:bg-harbor-mist"
                    >
                      <input
                        type="checkbox"
                        name="program_names"
                        value={program}
                        checked={programNames.includes(program)}
                        onChange={(event) => {
                          setProgramNames((current) =>
                            event.target.checked
                              ? [...current, program]
                              : current.filter((item) => item !== program)
                          );
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-harbor-ocean/20 text-harbor-sky"
                      />
                      <span>{program}</span>
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>

            <label className="block">
              <span className="label">Regular work schedule</span>
              <input
                name="availability"
                className="field mt-1.5"
                placeholder="Monday-Friday 9-5, weekends, overnights"
              />
            </label>

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
        ) : (
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
        )}

        <SubmitButton className="w-full py-3">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          Finish account setup
        </SubmitButton>
        <ActionFeedback state={state} />
        {state.ok ? (
          <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>Setup complete. Redirecting...</p>
          </div>
        ) : null}
      </form>
    </div>
  );
}
