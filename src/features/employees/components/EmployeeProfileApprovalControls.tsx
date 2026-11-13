"use client";

import { useActionState } from "react";
import { reviewProgramChangeAction } from "@/app/actions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
import type { AppRole } from "@/shared/types/domain";

const initialState = { ok: false, message: "" };

export function ProgramChangeApprovalControls({ profileId, profileRole }: {
  profileId: string;
  profileRole: AppRole;
}) {
  const [approveState, approveAction] = useActionState(
    reviewProgramChangeAction,
    initialState
  );
  const [rejectState, rejectAction] = useActionState(
    reviewProgramChangeAction,
    initialState
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <form action={approveAction}>
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="profile_role" value={profileRole} />
          <input type="hidden" name="decision" value="approve" />
          <SubmitButton
            className="min-h-0 px-2 py-1 text-xs"
          >
            Approve programs
          </SubmitButton>
        </form>
        <form action={rejectAction}>
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="profile_role" value={profileRole} />
          <input type="hidden" name="decision" value="reject" />
          <SubmitButton
            variant="secondary"
            className="min-h-0 px-2 py-1 text-xs"
          >
            Reject change
          </SubmitButton>
        </form>
      </div>
      <ActionFeedback state={approveState.message ? approveState : rejectState} />
    </div>
  );
}
