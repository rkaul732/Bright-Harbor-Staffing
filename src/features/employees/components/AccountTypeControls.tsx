"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { updateAccountTypeAction } from "@/app/actions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
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
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message && !state.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="min-w-[10rem] space-y-2">
      <input type="hidden" name="user_id" value={userId} />
      {programNames.map((programName) => (
        <input key={programName} type="hidden" name="program_names" value={programName} />
      ))}
      <AccountTypeSelect key={currentRole} currentRole={currentRole} disabled={disabled} />
      <ActionFeedback state={state} />
    </form>
  );
}

function AccountTypeSelect({
  currentRole,
  disabled
}: {
  currentRole: AppRole;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <select
      name="account_type"
      aria-label="Account type"
      defaultValue={currentRole}
      disabled={disabled || pending}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className="field h-9 min-w-0 py-1.5 text-xs"
    >
      <option value="super_admin">Super Admin</option>
      <option value="admin">Admin</option>
      <option value="supervisor">Supervisor</option>
      <option value="employee">Employee</option>
    </select>
  );
}
