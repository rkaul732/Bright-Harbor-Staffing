"use client";

import { useActionState } from "react";
import { Settings2 } from "lucide-react";
import { updateStaffProgramsAction } from "@/app/actions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { ProgramScopePicker } from "@/shared/components/ProgramScopePicker";
import { SubmitButton } from "@/shared/components/SubmitButton";
import type { ProgramName } from "@/shared/types/domain";

const initialState = { ok: false, message: "" };

export function ProgramAssignmentControls({
  userId,
  programNames,
  allowedProgramNames,
  disabled = false
}: {
  userId: string;
  programNames: ProgramName[];
  allowedProgramNames: ProgramName[];
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState(updateStaffProgramsAction, initialState);

  if (disabled) {
    return null;
  }

  return (
    <details className="mt-2 rounded-md border border-harbor-ocean/10 bg-harbor-mist/35">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-harbor-ocean">
        <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
        Edit programs
      </summary>
      <form action={formAction} className="border-t border-harbor-ocean/10 bg-white p-2">
        <input type="hidden" name="user_id" value={userId} />
        <ProgramScopePicker
          allowedProgramNames={allowedProgramNames}
          defaultSelectedProgramNames={programNames}
          legend="Designated programs"
          compact
        />
        {allowedProgramNames.length === 0 ? (
          <p className="mt-2 text-xs text-harbor-midnight/55">
            No programs are assigned to your admin account yet.
          </p>
        ) : null}
        <SubmitButton
          className="mt-3 min-h-0 w-full px-2.5 py-1.5 text-xs"
          disabled={allowedProgramNames.length === 0}
        >
          Save programs
        </SubmitButton>
        <ActionFeedback state={state} />
      </form>
    </details>
  );
}
