"use client";

import { useActionState } from "react";
import { Check, PauseCircle } from "lucide-react";
import { moderateProfileAction } from "@/app/actions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { ProgramScopePicker } from "@/shared/components/ProgramScopePicker";
import { SubmitButton } from "@/shared/components/SubmitButton";
import type { AppRole, ProgramName } from "@/shared/types/domain";

const initialState = { ok: false, message: "" };

export function ProfileModerationControls({
  profileId,
  profileRole,
  adminProgramNames = [],
  adminIsSuperAdmin = false
}: {
  profileId: string;
  profileRole: AppRole;
  adminProgramNames?: ProgramName[];
  adminIsSuperAdmin?: boolean;
}) {
  const [approveState, approveAction] = useActionState(moderateProfileAction, initialState);
  const [suspendState, suspendAction] = useActionState(moderateProfileAction, initialState);
  const showAdminScope = profileRole === "admin";

  return (
    <div className="mt-3 space-y-2">
      <div className={showAdminScope ? "space-y-2" : "grid grid-cols-2 gap-2"}>
        <form action={approveAction} className={showAdminScope ? "space-y-3" : undefined}>
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="profile_role" value={profileRole} />
          <input type="hidden" name="status" value="approved" />

          {showAdminScope ? (
            <div className="space-y-3 rounded-lg border border-harbor-ocean/10 bg-harbor-mist/55 p-3">
              <label className="flex items-start gap-2 text-sm text-harbor-midnight/75">
                <input
                  type="checkbox"
                  name="is_super_admin"
                  defaultChecked={adminIsSuperAdmin}
                  className="mt-0.5 h-4 w-4 rounded border-harbor-ocean/20 text-harbor-sky"
                />
                <span>Super admin access</span>
              </label>
              <ProgramScopePicker
                defaultSelectedProgramNames={adminProgramNames}
                legend="Programs this admin oversees"
                compact
              />
            </div>
          ) : null}

          <SubmitButton className="w-full">
            <Check className="h-4 w-4" aria-hidden="true" />
            {showAdminScope ? "Save access" : "Approve"}
          </SubmitButton>
        </form>
        <form action={suspendAction}>
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="profile_role" value={profileRole} />
          <input type="hidden" name="status" value="suspended" />
          <SubmitButton variant="secondary" className="w-full">
            <PauseCircle className="h-4 w-4" aria-hidden="true" />
            Suspend
          </SubmitButton>
        </form>
      </div>
      <ActionFeedback state={approveState.message ? approveState : suspendState} />
    </div>
  );
}
