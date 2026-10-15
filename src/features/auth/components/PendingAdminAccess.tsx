"use client";

import { useRouter } from "next/navigation";
import { Clock3, LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/browser";
import { isSupabaseConfigured } from "@/shared/lib/supabase/env";

export function PendingAdminAccess({ suspended = false }: { suspended?: boolean }) {
  const router = useRouter();

  async function signOut() {
    if (isSupabaseConfigured()) {
      await createSupabaseBrowserClient().auth.signOut();
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-84px)] max-w-3xl items-center px-4 py-10 sm:px-6">
      <section className="panel w-full p-7 shadow-soft sm:p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-harbor-mist text-harbor-ocean">
          <Clock3 className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="label mt-7">Admin account setup</p>
        <h1 className="mt-2 text-3xl font-semibold text-harbor-midnight">
          {suspended ? "Admin access is unavailable" : "Access is awaiting approval"}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-harbor-midnight/70">
          {suspended
            ? "Your admin access is currently suspended. Contact a super admin if you believe this needs review."
            : "Your account and division choices have been submitted. A super admin must approve your program access before you can use the admin dashboard."}
        </p>
        <button type="button" onClick={signOut} className="secondary-button mt-7">
          <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
        </button>
      </section>
    </main>
  );
}
