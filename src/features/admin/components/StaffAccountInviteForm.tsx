"use client";

import { useActionState, useState } from "react";
import { MailPlus } from "lucide-react";
import { createStaffAccountAction } from "@/app/actions";
import { PROGRAMS } from "@/shared/lib/constants";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { ProgramScopePicker } from "@/shared/components/ProgramScopePicker";
import { SubmitButton } from "@/shared/components/SubmitButton";
import type { AppRole } from "@/shared/types/domain";

const initialState = { ok: false, message: "" };

export function StaffAccountInviteForm({ canInviteAdmin = false }: { canInviteAdmin?: boolean }) {
  const [state, formAction] = useActionState(createStaffAccountAction, initialState);
  const [role, setRole] = useState<AppRole | "admin_supervisor">("employee");

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
          <span className="label">Bright Harbor email</span>
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
          {canInviteAdmin ? <option value="admin">Admin</option> : null}
          {canInviteAdmin ? <option value="admin_supervisor">Admin and supervisor</option> : null}
        </select>
      </label>

      {role === "admin" ? (
        <p className="rounded-lg border border-harbor-sky/20 bg-harbor-mist px-3 py-2 text-sm leading-6 text-harbor-midnight/70">
          The invited admin will choose their divisions during account setup. A super admin must approve their program access.
        </p>
      ) : (
        <ProgramScopePicker
          allowedProgramNames={PROGRAMS}
          defaultSelectedProgramNames={role === "admin_supervisor" ? [] : PROGRAMS.slice(0, 1)}
          legend={role === "admin_supervisor" ? "Supervisor programs (admin scope is reviewed during setup)" : role === "supervisor" ? "Supervisor assigned programs" : "Starting programs"}
          compact
        />
      )}

      <SubmitButton className="w-full">
        <MailPlus className="h-4 w-4" aria-hidden="true" />
        Create account and send setup email
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}
