"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, LogIn, UserPlus } from "lucide-react";
import {
  PROGRAMS,
  ROLE_DASHBOARD_PATHS,
  ROLE_LABELS
} from "@/shared/lib/constants";
import { isSupabaseConfigured } from "@/shared/lib/supabase/env";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/browser";
import { cn } from "@/shared/lib/cn";
import type { AppRole, ProgramName } from "@/shared/types/domain";

type AuthMode = "sign-in" | "sign-up";

const roles: AppRole[] = ["employee", "admin"];

export function AuthPanel({
  initialRole = "employee",
  nextPath
}: {
  initialRole?: AppRole;
  nextPath?: string;
}) {
  const router = useRouter();
  const [role, setRole] = useState<AppRole>(initialRole);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [programNames, setProgramNames] = useState<ProgramName[]>([PROGRAMS[0]]);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const configured = useMemo(() => isSupabaseConfigured(), []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!email.includes("@") || password.length < 6) {
      setMessage("Use a valid email and a password with at least 6 characters.");
      return;
    }

    if (mode === "sign-up" && role === "employee" && programNames.length === 0) {
      setMessage("Choose at least one program.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (!configured) {
        router.push(nextPath || ROLE_DASHBOARD_PATHS[role]);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const result =
        mode === "sign-in"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  role,
                  full_name: fullName || email.split("@")[0],
                  program_name: role === "employee" ? programNames[0] : undefined,
                  program_names: role === "employee" ? programNames : undefined
                },
                emailRedirectTo: `${window.location.origin}${ROLE_DASHBOARD_PATHS[role]}`
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

      router.push(nextPath || ROLE_DASHBOARD_PATHS[role]);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="panel mx-auto w-full max-w-md p-5 sm:p-6">
      <div>
        <p className="label">Account access</p>
        <h1 className="mt-2 text-3xl font-medium text-harbor-midnight">
          {mode === "sign-in" ? "Welcome back" : "Create your profile"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-harbor-midnight/70">
          {configured
            ? "Sign in with Supabase Auth to reach your protected dashboard."
            : "Demo mode is active because Supabase keys are not configured yet."}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 rounded-lg bg-harbor-mist p-1">
        {roles.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setRole(item)}
            className={cn(
              "focus-ring rounded-md px-2 py-2 text-sm font-medium transition",
              role === item
                ? "bg-white text-harbor-midnight shadow-line"
                : "text-harbor-ocean hover:bg-white/60"
            )}
          >
            {ROLE_LABELS[item]}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {mode === "sign-up" ? (
          <div className="space-y-4">
            <label className="block">
              <span className="label">Full name</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="field mt-1.5"
                placeholder="Jamie Rivera"
                autoComplete="name"
              />
            </label>
            {role === "employee" ? (
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
            ) : null}
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
        </label>

        <label className="block">
          <span className="label">Password</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field mt-1.5"
            placeholder="At least 6 characters"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
          />
        </label>

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
              ? `Sign in as ${ROLE_LABELS[role]}`
              : `Create ${ROLE_LABELS[role]} account`}
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
