"use client";

import { RefreshCw } from "lucide-react";

export default function ErrorPage({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="pill bg-red-50 text-red-700">Something went wrong</p>
      <h1 className="mt-4 text-3xl font-medium text-harbor-midnight">
        The shift hub could not load.
      </h1>
      <p className="mt-3 text-harbor-midnight/70">
        Try again in a moment. If this keeps happening, check Supabase credentials
        and database policies.
      </p>
      <button type="button" onClick={reset} className="primary-button mt-6">
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Try again
      </button>
    </main>
  );
}
