"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, LogIn, UserPlus } from "lucide-react";
import {
  PROGRAMS,
  ROLE_DASHBOARD_PATHS
} from "@/shared/lib/constants";
import { isSupabaseConfigured } from "@/shared/lib/supabase/env";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/browser";
import { getPasswordRequirementMessage } from "@/shared/lib/password";
import { AvailabilityCheckboxGroup } from "@/shared/components/AvailabilityCheckboxGroup";
import type { ProgramName } from "@/shared/types/domain";

type AuthMode = "sign-in" | "sign-up";

async function recordLastLogin(supabase: ReturnType<typeof createSupabaseBrowserClient>) {
  try {
    await supabase.rpc("record_current_user_login", {
      login_at: new Date().toISOString()
    });
  } catch {
    // Last-login tracking should not block account access.
  }
}

async function dashboardPathForSignedInUser(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  userId?: string
) {
  if (!userId) {
    return ROLE_DASHBOARD_PATHS.employee;
  }

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = data?.role;

  if (role === "admin" || role === "supervisor" || role === "employee") {
    return ROLE_DASHBOARD_PATHS[role];
  }

  return ROLE_DASHBOARD_PATHS.employee;
}

export function AuthPanel({
  nextPath,
  initialMode = "sign-in"
}: {
  nextPath?: string;
  initialMode?: AuthMode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [programNames, setProgramNames] = useState<ProgramName[]>([PROGRAMS[0]]);
  const [availability, setAvailability] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const configured = useMemo(() => isSupabaseConfigured(), []);

  async function handleForgotPassword() {
    setMessage(null);

    if (!email.includes("@")) {
      setMessage("Enter your email first, then choose Forgot password.");
      return;
    }

    if (!configured) {
      setMessage("Demo mode is active. Password reset emails require Supabase Auth.");
      return;
    }

    setIsSendingReset(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Check your email for a password reset link.");
    } finally {
      setIsSendingReset(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail.includes("@")) {
      setMessage("Use a valid email address.");
      return;
    }

    if (mode === "sign-up") {
      if (!/^[^@\s]+@brightharbor\.org$/i.test(normalizedEmail)) {
        const errorMessage = "You must use your Bright Harbor Email.";
        setMessage(errorMessage);
        window.alert(errorMessage);
        return;
      }

      const passwordRequirementMessage = getPasswordRequirementMessage(password);

      if (passwordRequirementMessage) {
        setMessage(passwordRequirementMessage);
        return;
      }
    }

    if (mode === "sign-in" && password.length < 1) {
      setMessage("Enter your password.");
      return;
    }

    if (mode === "sign-up" && (!firstName.trim() || !lastName.trim())) {
      setMessage("Enter your first and last name.");
      return;
    }

    if (mode === "sign-up" && programNames.length === 0) {
      setMessage("Choose at least one program.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (!configured) {
        router.push(nextPath || ROLE_DASHBOARD_PATHS.employee);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      const result =
        mode === "sign-in"
          ? await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
          : await supabase.auth.signUp({
              email: normalizedEmail,
              password,
              options: {
                data: {
                  role: "employee",
                  full_name: fullName || normalizedEmail.split("@")[0],
                  first_name: firstName.trim() || undefined,
                  last_name: lastName.trim() || undefined,
                  program_name: programNames[0],
                  program_names: programNames,
                  availability
                },
                emailRedirectTo: `${window.location.origin}/auth/callback?next=${ROLE_DASHBOARD_PATHS.employee}`
              }
            });

      if (result.error) {
        setMessage(result.error.message);
        return;
      }

      if (mode === "sign-up" && !result.data.session) {
        setMessage("Check your email to confirm your account, then sign in.");
        return;
      }

      if (result.data.session) {
        await recordLastLogin(supabase);
      }

      const dashboardPath = await dashboardPathForSignedInUser(
        supabase,
        result.data.user?.id
      );
      router.push(nextPath || dashboardPath);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="panel mx-auto w-full max-w-xl p-6 shadow-soft sm:p-9">
      <div>
        <p className="label">Account access</p>
        <h1 className="mt-3 text-3xl font-semibold text-harbor-midnight sm:text-4xl">
          {mode === "sign-in" ? "Welcome back" : "Create your profile"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-harbor-midnight/70">
          {configured
            ? mode === "sign-in"
              ? "Log in with your Bright Harbor account to reach the right dashboard for your role."
              : "Register with your Bright Harbor email to access your personal staffing workspace."
            : "Demo mode is active because Supabase keys are not configured yet."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 space-y-5">
        {mode === "sign-up" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">First name</span>
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className="field mt-1.5"
                  placeholder="Jamie"
                  autoComplete="given-name"
                  required
                />
              </label>
              <label className="block">
                <span className="label">Last name</span>
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className="field mt-1.5"
                  placeholder="Rivera"
                  autoComplete="family-name"
                  required
                />
              </label>
            </div>
            <fieldset>
              <legend className="label">Programs</legend>
              <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-harbor-ocean/10 bg-white p-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  {PROGRAMS.map((program) => (
                    <label
                      key={program}
                      className="flex items-start gap-2 rounded-md px-2 py-2 text-sm text-harbor-midnight/75 hover:bg-harbor-mist"
                    >
                      <input
                        type="checkbox"
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
          </div>
        ) : null}

        <label className="block">
          <span className="label">Email</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field mt-1.5"
            placeholder="you@brightharbor.org"
            type="email"
            autoComplete="email"
            required
          />
          {mode === "sign-up" ? (
            <span className="mt-1 block text-xs text-harbor-midnight/60">
              Use your @brightharbor.org email address.
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="label">Password</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field mt-1.5"
            placeholder="At least 8 characters"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
          />
          {mode === "sign-in" ? (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isSendingReset || isSubmitting}
              className="word-button mt-2 w-fit px-0 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSendingReset ? "Sending reset link..." : "Forgot password?"}
            </button>
          ) : null}
        </label>

        {mode === "sign-up" ? (
          <details className="rounded-xl border border-harbor-ocean/10 bg-harbor-mist/45 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-harbor-ocean">Add general availability <span className="font-normal text-harbor-midnight/55">(optional)</span></summary>
            <div className="mt-4"><AvailabilityCheckboxGroup selected={availability} onChange={setAvailability} /></div>
          </details>
        ) : null}

        {message ? (
          <div className="flex gap-2 rounded-lg border border-harbor-sky/20 bg-harbor-mist px-3 py-2 text-sm text-harbor-midnight/70">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-harbor-ocean" aria-hidden="true" />
            <p>{message}</p>
          </div>
        ) : null}

        <button type="submit" disabled={isSubmitting} className="primary-button w-full py-2">
          {mode === "sign-in" ? (
            <LogIn className="h-4 w-4" aria-hidden="true" />
          ) : (
            <UserPlus className="h-4 w-4" aria-hidden="true" />
          )}
          {isSubmitting
            ? "Working..."
            : mode === "sign-in"
              ? "Login"
              : "Create employee account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          setMessage(null);
        }}
        className="ghost-button mt-4 w-full"
      >
        {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
