"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, Check, X } from "lucide-react";
import {
  submitTimeOffRequestAction,
  updateTimeOffRequestStatusAction
} from "@/app/actions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
import type { AppRole, ProgramName, TimeOffRequest } from "@/shared/types/domain";

const initialState = { ok: false, message: "" };

export function TimeOffRequestForm({
  programNames
}: {
  programNames: ProgramName[];
}) {
  const [state, formAction] = useActionState(submitTimeOffRequestAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="label">Program</span>
        <select name="program_name" className="field mt-1.5" required>
          {programNames.map((program) => (
            <option key={program} value={program}>
              {program}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Start date</span>
          <input name="start_date" type="date" className="field mt-1.5" required />
        </label>
        <label className="block">
          <span className="label">End date</span>
          <input name="end_date" type="date" className="field mt-1.5" required />
        </label>
      </div>
      <label className="block">
        <span className="label">Reason</span>
        <textarea
          name="reason"
          className="field mt-1.5 min-h-24"
          placeholder="Briefly describe the time off request."
          required
        />
      </label>
      <SubmitButton>
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        Submit time off request
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}

export function TimeOffApprovalControls({
  request,
  role = "admin"
}: {
  request: TimeOffRequest;
  role?: AppRole;
}) {
  const [approveState, approveAction] = useActionState(
    updateTimeOffRequestStatusAction,
    initialState
  );
  const [declineState, declineAction] = useActionState(
    updateTimeOffRequestStatusAction,
    initialState
  );
  const [reviewComment, setReviewComment] = useState("");

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="label">Comment for employee</span>
        <textarea
          value={reviewComment}
          onChange={(event) => setReviewComment(event.target.value)}
          className="field mt-1.5 min-h-20"
          placeholder="Optional note shown to the employee after review."
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <form action={approveAction}>
          <input type="hidden" name="request_id" value={request.id} />
          <input type="hidden" name="status" value="approved" />
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="review_comment" value={reviewComment} />
          <SubmitButton className="w-full">
            <Check className="h-4 w-4" aria-hidden="true" />
            Approve
          </SubmitButton>
        </form>
        <form action={declineAction}>
          <input type="hidden" name="request_id" value={request.id} />
          <input type="hidden" name="status" value="declined" />
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="review_comment" value={reviewComment} />
          <SubmitButton variant="secondary" className="w-full">
            <X className="h-4 w-4" aria-hidden="true" />
            Decline
          </SubmitButton>
        </form>
      </div>
      <ActionFeedback state={approveState.message ? approveState : declineState} />
    </div>
  );
}
