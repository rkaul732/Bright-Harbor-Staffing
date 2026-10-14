"use client";

import { useActionState } from "react";
import { updateAccountTypeAction } from "@/app/actions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
import type { AppRole, ProgramName } from "@/shared/types/domain";

const initialState = { ok: false, message: "" };

export function AccountTypeControls({
  userId,
  currentRole,
  programNames,
  disabled = false
}: {
  userId: string;
  currentRole: AppRole;
  programNames: ProgramName[];
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState(updateAccountTypeAction, initialState);

  return (
    <form action={formAction} className="min-w-[15rem] space-y-2">
      <input type="hidden" name="user_id" value={userId} />
      {programNames.map((programName) => (
        <input key={programName} type="hidden" name="program_names" value={programName} />
      ))}
      <div className="flex items-center gap-2">
        <select
          name="account_type"
          defaultValue={currentRole}
          disabled={disabled}
          className="field h-9 min-w-0 py-1.5 text-xs"
        >
          <option value="employee">Employee</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Admin</option>
        </select>
        <SubmitButton
          className="min-h-0 shrink-0 px-2.5 py-1.5 text-xs"
          disabled={disabled}
        >
          Update
        </SubmitButton>
      </div>
      <ActionFeedback state={state} />
    </form>
  );
}
