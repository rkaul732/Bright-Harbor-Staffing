"use client";

import { useActionState } from "react";
import { Check, PauseCircle } from "lucide-react";
import { moderateProfileAction } from "@/app/actions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
import type { AppRole } from "@/shared/types/domain";

const initialState = { ok: false, message: "" };

export function ProfileModerationControls({
  profileId,
  profileRole
}: {
  profileId: string;
  profileRole: AppRole;
}) {
  const [approveState, approveAction] = useActionState(moderateProfileAction, initialState);
  const [suspendState, suspendAction] = useActionState(moderateProfileAction, initialState);

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <form action={approveAction}>
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="profile_role" value={profileRole} />
          <input type="hidden" name="status" value="approved" />
          <SubmitButton className="w-full">
            <Check className="h-4 w-4" aria-hidden="true" />
            Approve
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
