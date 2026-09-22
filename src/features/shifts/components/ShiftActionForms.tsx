"use client";

import { useActionState, useState } from "react";
import { Bookmark, Check, MessageSquare, Send, X } from "lucide-react";
import {
  cancelShiftAction,
  requestShiftAction,
  rescheduleShiftAction,
  saveShiftAction,
  sendMessageAction,
  updateRequestStatusAction
} from "@/app/actions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
import { cn } from "@/shared/lib/cn";
import type { AppRole, ShiftPost, ShiftRequest } from "@/shared/types/domain";

const initialState = { ok: false, message: "" };

export function RequestShiftForm({
  shift,
  className
}: {
  shift: ShiftPost;
  className?: string;
}) {
  const [state, formAction] = useActionState(requestShiftAction, initialState);
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className={cn("primary-button w-full", className)}
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        Request
      </button>
      <ActionFeedback state={state} />

      {isConfirming ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-harbor-midnight/45 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`request-shift-${shift.id}`}
        >
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label">Shift request</p>
                <h2
                  id={`request-shift-${shift.id}`}
                  className="mt-2 text-xl font-medium text-harbor-midnight"
                >
                  Are you sure you want to request this shift?
                </h2>
                <p className="mt-2 text-sm leading-6 text-harbor-midnight/65">
                  This will route your request to the supervisor for approval.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="ghost-button px-2"
                aria-label="Close request confirmation"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form action={formAction} className="mt-5 space-y-3">
              <input type="hidden" name="shift_id" value={shift.id} />
              <SubmitButton className="w-full">
                <Send className="h-4 w-4" aria-hidden="true" />
                Request
              </SubmitButton>
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="secondary-button w-full justify-center"
              >
                No, go back
              </button>
              <ActionFeedback state={state} />
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function SaveShiftForm({ shift }: { shift: ShiftPost }) {
  const [state, formAction] = useActionState(saveShiftAction, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="shift_id" value={shift.id} />
      <SubmitButton variant="secondary" className="w-full">
        <Bookmark className="h-4 w-4" aria-hidden="true" />
        Save
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}

export function ApprovalControls({
  request,
  role = "supervisor"
}: {
  request: ShiftRequest;
  role?: AppRole;
}) {
  const [approveState, approveAction] = useActionState(
    updateRequestStatusAction,
    initialState
  );
  const [declineState, declineAction] = useActionState(
    updateRequestStatusAction,
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
          <input type="hidden" name="shift_id" value={request.shift_id} />
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
          <input type="hidden" name="shift_id" value={request.shift_id} />
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

export function MessageForm({
  request,
  role = "supervisor"
}: {
  request: ShiftRequest;
  role?: AppRole;
}) {
  const [state, formAction] = useActionState(sendMessageAction, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="request_id" value={request.id} />
      <input type="hidden" name="shift_id" value={request.shift_id} />
      <input type="hidden" name="recipient_id" value={request.requestor_id} />
      <input type="hidden" name="role" value={role} />
      <label className="block">
        <span className="label">Message requestor</span>
        <textarea
          name="body"
          className="field mt-1.5 min-h-20"
          placeholder="Ask a follow-up or send confirmation details."
        />
      </label>
      <SubmitButton variant="secondary" className="w-full">
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
        Send message
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}

export function RescheduleShiftForm({
  shift,
  role = "supervisor"
}: {
  shift: ShiftPost;
  role?: AppRole;
}) {
  const [state, formAction] = useActionState(rescheduleShiftAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="shift_id" value={shift.id} />
      <input type="hidden" name="role" value={role} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label">New date</span>
          <input name="new_shift_date" type="date" className="field mt-1.5" required />
        </label>
        <label className="block">
          <span className="label">Start</span>
          <input name="new_start_time" type="time" className="field mt-1.5" required />
        </label>
        <label className="block">
          <span className="label">End</span>
          <input name="new_end_time" type="time" className="field mt-1.5" required />
        </label>
      </div>
      <label className="block">
        <span className="label">Reason</span>
        <textarea name="reason" className="field mt-1.5 min-h-16" />
      </label>
      <SubmitButton variant="secondary">Request reschedule</SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}

export function CancelShiftForm({
  shift,
  role = "supervisor"
}: {
  shift: ShiftPost;
  role?: AppRole;
}) {
  const [state, formAction] = useActionState(cancelShiftAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="shift_id" value={shift.id} />
      <input type="hidden" name="role" value={role} />
      <label className="block">
        <span className="label">Cancellation reason</span>
        <textarea name="reason" className="field mt-1.5 min-h-16" required />
      </label>
      <SubmitButton variant="secondary">Request cancellation</SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}
