"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/browser";
import { isSupabaseConfigured } from "@/shared/lib/supabase/env";

export function ResetPasswordPanel() {
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPreparingReset, setIsPreparingReset] = useState(configured);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!configured) {
      return;
    }

    let active = true;
    const supabase = createSupabaseBrowserClient();

    async function prepareResetSession() {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            throw error;
          }
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            throw error;
          }
        }

        const { data } = await supabase.auth.getUser();

        if (active && !data.user) {
          setMessage("Open the password reset link from your email before setting a new password.");
        }

        if ((code || accessToken) && active) {
          window.history.replaceState(null, "", "/auth/reset");
        }
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : "Could not open the password reset link.");
        }
      } finally {
        if (active) {
          setIsPreparingReset(false);
        }
      }
    }

    prepareResetSession();

    return () => {
      active = false;
    };
  }, [configured]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage("Use a password with at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (!configured) {
      setSuccess(true);
      setMessage("Demo mode: password reset completed.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        setMessage("Open the password reset link from your email before setting a new password.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessage(error.message);
        return;
      }

      await supabase.auth.signOut();
      setSuccess(true);
      setMessage("Password updated. You can sign in with your new password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="panel mx-auto w-full max-w-md p-5 sm:p-6">
      <div>
        <p className="label">Password reset</p>
        <h1 className="mt-2 text-3xl font-medium text-harbor-midnight">
          Set a new password
        </h1>
        <p className="mt-2 text-sm leading-6 text-harbor-midnight/70">
          {isPreparingReset
            ? "Checking your password reset link..."
            : "Enter a new password for your Bright Harbor Staffing account."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <label className="block">
          <span className="label">New password</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field mt-1.5"
            placeholder="At least 8 characters"
            type="password"
            autoComplete="new-password"
            required
          />
        </label>

        <label className="block">
          <span className="label">Confirm password</span>
          <input
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="field mt-1.5"
            placeholder="Retype password"
            type="password"
            autoComplete="new-password"
            required
          />
        </label>

        {message ? (
          <div className="flex gap-2 rounded-lg border border-harbor-sky/20 bg-harbor-mist px-3 py-2 text-sm text-harbor-midnight/70">
            {success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-harbor-ocean" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-harbor-ocean" aria-hidden="true" />
            )}
            <p>{message}</p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isPreparingReset || isSubmitting || success}
          className="primary-button w-full py-2"
        >
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          {isPreparingReset ? "Checking link..." : isSubmitting ? "Updating..." : "Update password"}
        </button>
      </form>

      <Link href="/auth" className="ghost-button mt-4 w-full">
        Back to login
      </Link>
    </div>
  );
}
