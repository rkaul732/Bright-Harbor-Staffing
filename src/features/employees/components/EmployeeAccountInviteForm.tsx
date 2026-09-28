"use client";

import { useActionState } from "react";
import { MailPlus } from "lucide-react";
import { createStaffAccountAction } from "@/app/actions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
import { ProgramScopePicker } from "@/shared/components/ProgramScopePicker";
import type { ProgramName } from "@/shared/types/domain";

const initialState = { ok: false, message: "" };

export function EmployeeAccountInviteForm({
  programNames
}: {
  programNames: ProgramName[];
}) {
  const [state, formAction] = useActionState(createStaffAccountAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="role" value="employee" />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Employee name</span>
          <input
            name="full_name"
            className="field mt-1.5"
            placeholder="Jamie Rivera"
            required
          />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input
            name="email"
            type="email"
            className="field mt-1.5"
            placeholder="employee@brightharbor.org"
            required
          />
        </label>
      </div>
      <ProgramScopePicker
        allowedProgramNames={programNames}
        defaultSelectedProgramNames={programNames.slice(0, 1)}
        legend="Starting programs"
        compact
      />
      {programNames.length === 0 ? (
        <p className="text-xs text-harbor-midnight/55">
          No programs are assigned to your admin account yet.
        </p>
      ) : null}

      <SubmitButton className="w-full" disabled={programNames.length === 0}>
        <MailPlus className="h-4 w-4" aria-hidden="true" />
        Send employee setup email
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}
