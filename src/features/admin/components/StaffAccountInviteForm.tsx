"use client";

import { useActionState, useState } from "react";
import { MailPlus } from "lucide-react";
import { createStaffAccountAction } from "@/app/actions";
import { PROGRAMS } from "@/shared/lib/constants";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
import type { AppRole } from "@/shared/types/domain";

const initialState = { ok: false, message: "" };

export function StaffAccountInviteForm() {
  const [state, formAction] = useActionState(createStaffAccountAction, initialState);
  const [role, setRole] = useState<Extract<AppRole, "employee" | "supervisor">>("employee");

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <label className="block">
          <span className="label">Staff name</span>
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

      <label className="block">
        <span className="label">Account type</span>
        <select
          name="role"
          value={role}
          onChange={(event) => setRole(event.target.value as typeof role)}
          className="field mt-1.5"
        >
          <option value="employee">Employee</option>
          <option value="supervisor">Supervisor</option>
        </select>
      </label>

      {role === "employee" ? (
        <fieldset>
          <legend className="label">Starting programs</legend>
          <div className="mt-2 max-h-52 overflow-auto rounded-lg border border-harbor-ocean/10 bg-white p-2">
            <div className="grid gap-2">
              {PROGRAMS.map((program, index) => (
                <label
                  key={program}
                  className="flex items-start gap-2 rounded-md px-2 py-2 text-sm text-harbor-midnight/75 hover:bg-harbor-mist"
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
        </fieldset>
      ) : null}

      <SubmitButton className="w-full">
        <MailPlus className="h-4 w-4" aria-hidden="true" />
        Send setup email
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}
