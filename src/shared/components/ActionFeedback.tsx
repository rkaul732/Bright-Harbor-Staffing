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
          ? "border-harbor-ocean/20 bg-harbor-mist text-harbor-ocean"
          : "border-harbor-midnight/20 bg-harbor-lemon/55 text-harbor-midnight"
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
