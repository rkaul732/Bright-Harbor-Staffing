"use client";

import { useActionState } from "react";
import { moderateProfileAction } from "@/app/actions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
import type { WorkerProfile } from "@/shared/types/domain";

const initialState = { ok: false, message: "" };

export function EmployeeProfileApprovalControls({
  profile
}: {
  profile?: WorkerProfile;
}) {
  const [approveState, approveAction] = useActionState(
    moderateProfileAction,
    initialState
  );
  const [suspendState, suspendAction] = useActionState(
    moderateProfileAction,
    initialState
  );

  if (!profile) {
    return (
      <span className="text-xs text-harbor-midnight/45">
        Awaiting profile
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <form action={approveAction}>
          <input type="hidden" name="profile_id" value={profile.id} />
          <input type="hidden" name="profile_role" value="employee" />
          <input type="hidden" name="status" value="approved" />
          <SubmitButton
            className="min-h-0 px-2 py-1 text-xs"
            disabled={profile.status === "approved"}
          >
            Yes
          </SubmitButton>
        </form>
        <form action={suspendAction}>
          <input type="hidden" name="profile_id" value={profile.id} />
          <input type="hidden" name="profile_role" value="employee" />
          <input type="hidden" name="status" value="suspended" />
          <SubmitButton
            variant="secondary"
            className="min-h-0 px-2 py-1 text-xs"
            disabled={profile.status === "suspended"}
          >
            No
          </SubmitButton>
        </form>
      </div>
      <ActionFeedback state={approveState.message ? approveState : suspendState} />
    </div>
  );
}
