"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/browser";
import { isSupabaseConfigured } from "@/shared/lib/supabase/env";

export function RequestPasswordResetPanel() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^@\s]+@brightharbor\.org$/.test(normalizedEmail)) {
      setMessage("Enter your Bright Harbor email address.");
      return;
    }

    if (!isSupabaseConfigured()) {
      setMessage("Password recovery is temporarily unavailable.");
      return;
    }

    setSending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/auth/reset`
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setSent(true);
      setMessage("Check your Bright Harbor email for a password reset link.");
    } catch {
      setMessage("We could not send a reset link right now. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="panel mx-auto w-full max-w-md p-5 sm:p-6">
      <p className="label">Account security</p>
      <h1 className="mt-2 text-3xl font-medium text-harbor-midnight">Reset your password</h1>
      <p className="mt-2 text-sm leading-6 text-harbor-midnight/70">
        Enter your Bright Harbor email. We’ll send a secure link so you can choose a new password.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="label">Bright Harbor email</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@brightharbor.org"
            className="field mt-1.5"
            required
          />
        </label>

        {message ? (
          <div className="flex gap-2 rounded-lg border border-harbor-sky/20 bg-harbor-mist px-3 py-2 text-sm text-harbor-midnight/70" role="status">
            {sent ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-harbor-ocean" aria-hidden="true" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-harbor-ocean" aria-hidden="true" />}
            <p>{message}</p>
          </div>
        ) : null}

        <button type="submit" disabled={sending || sent} className="primary-button w-full py-2">
          <Mail className="h-4 w-4" aria-hidden="true" />
          {sending ? "Sending link..." : sent ? "Reset link sent" : "Send reset link"}
        </button>
      </form>

      <Link href="/auth" className="word-button mt-4 inline-block px-0 py-1 text-sm">Back to sign in</Link>
    </div>
  );
}
