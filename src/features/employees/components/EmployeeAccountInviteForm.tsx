"use client";

import { useActionState } from "react";
import { MailPlus } from "lucide-react";
import { createStaffAccountAction } from "@/app/actions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
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

      <fieldset>
        <legend className="label">Starting programs</legend>
        <div className="mt-2 max-h-48 overflow-auto rounded-lg border border-harbor-ocean/10 bg-white p-2">
          <div className="grid gap-1 sm:grid-cols-2">
            {programNames.map((program, index) => (
              <label
                key={program}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs text-harbor-midnight/75 hover:bg-harbor-mist"
              >
                <input
                  type="checkbox"
                  name="program_names"
                  value={program}
                  defaultChecked={index === 0}
                  className="mt-0.5 h-4 w-4 rounded border-harbor-ocean/20 text-harbor-sky"
                />
                <span>{program}</span>
              </label>
            ))}
          </div>
        </div>
        {programNames.length === 0 ? (
          <p className="mt-2 text-xs text-harbor-midnight/55">
            No programs are assigned to your admin account yet.
          </p>
        ) : null}
      </fieldset>

      <SubmitButton className="w-full" disabled={programNames.length === 0}>
        <MailPlus className="h-4 w-4" aria-hidden="true" />
        Send employee setup email
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}
