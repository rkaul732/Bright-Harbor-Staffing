"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

export function ActionFeedback({
  state
}: {
  state: { ok: boolean; message: string };
}) {
  if (!state.message) {
    return null;
  }

  return (
    <div
      className={`mt-3 flex gap-2 rounded-lg border px-3 py-2 text-sm ${
        state.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {state.ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <p>{state.message}</p>
    </div>
  );
}
