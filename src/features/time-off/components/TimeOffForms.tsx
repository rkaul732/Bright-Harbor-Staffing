"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, Check, X } from "lucide-react";
import {
  adminAddOutOfOfficeAction,
  submitTimeOffRequestAction,
  updateTimeOffRequestStatusAction
} from "@/app/actions";
import { getProgramLabel } from "@/shared/lib/constants";
import { formatShortDate } from "@/shared/lib/dates";
import { hasTeamTimeOffCoordination, overlappingTeamTimeOffDates, teamTimeOffSelectionKey, type TeamTimeOffDate } from "@/shared/lib/team-time-off";
import { ProgramSelectOptions } from "@/shared/components/ProgramSelectOptions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
import type { AppRole, ProgramName, TimeOffRequest } from "@/shared/types/domain";

const initialState = { ok: false, message: "" };

export function TimeOffRequestForm({
  programNames,
  teamTimeOffDates = [],
  teamAvailabilityAvailable = true
}: {
  programNames: ProgramName[];
  teamTimeOffDates?: TeamTimeOffDate[];
  teamAvailabilityAvailable?: boolean;
}) {
  const [state, formAction] = useActionState(
    submitTimeOffRequestAction,
    initialState as Awaited<ReturnType<typeof submitTimeOffRequestAction>>
  );
  const [programName, setProgramName] = useState<ProgramName | "">(programNames[0] ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [spokeWithSupervisor, setSpokeWithSupervisor] = useState(false);
  const selectionKey = teamTimeOffSelectionKey(programName, startDate, endDate);
  const calendarConflicts = overlappingTeamTimeOffDates(teamTimeOffDates, programName, startDate, endDate);
  const newlyDetectedConflicts = state.conflictKey === selectionKey ? state.conflictDates ?? [] : [];
  const conflictDates = [...new Set([...calendarConflicts, ...newlyDetectedConflicts])].sort();
  const needsTeamCheck = hasTeamTimeOffCoordination(programName);
  const visibleState = state.conflictKey && state.conflictKey !== selectionKey ? initialState : state;

  if (programNames.length === 0) {
    return <p className="rounded-lg border border-harbor-ocean/15 bg-harbor-mist p-4 text-sm text-harbor-midnight/75">
      Your account is ready to use. You can request time off once your first program assignment is approved.
    </p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="label">Program</span>
        <select
          name="program_name"
          value={programName}
          onChange={(event) => {
            setProgramName(event.target.value as ProgramName);
            setSpokeWithSupervisor(false);
          }}
          className="field mt-1.5"
          required
        >
          {programNames.map((program) => (
            <option key={program} value={program}>
              {getProgramLabel(program)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Start date</span>
          <input
            name="start_date"
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              setSpokeWithSupervisor(false);
            }}
            className="field mt-1.5"
            required
          />
        </label>
        <label className="block">
          <span className="label">End date</span>
          <input
            name="end_date"
            type="date"
            value={endDate}
            onChange={(event) => {
              setEndDate(event.target.value);
              setSpokeWithSupervisor(false);
            }}
            className="field mt-1.5"
            required
          />
        </label>
      </div>
      {needsTeamCheck && !teamAvailabilityAvailable ? (
        <p role="status" className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
          Team availability could not load. Your dates will be checked again when you submit.
        </p>
      ) : null}
      {needsTeamCheck && conflictDates.length > 0 ? (
        <div role="alert" className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950">
          <p className="font-semibold">
            A teammate is already approved off on {conflictDates.slice(0, 4).map(formatShortDate).join(", ")}
            {conflictDates.length > 4 ? ` and ${conflictDates.length - 4} more date${conflictDates.length - 4 === 1 ? "" : "s"}` : ""}.
          </p>
          <p className="mt-1">Choose alternative dates above, or speak with your supervisor before submitting this request.</p>
          <label className="mt-3 flex items-start gap-2 font-medium">
            <input
              type="checkbox"
              name="supervisor_contact_confirmed"
              checked={spokeWithSupervisor}
              onChange={(event) => setSpokeWithSupervisor(event.target.checked)}
              className="mt-1"
              required
            />
            <span>I have spoken with my supervisor about these dates.</span>
          </label>
        </div>
      ) : null}
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
      <ActionFeedback state={visibleState} />
    </form>
  );
}

export function AdminOutOfOfficeForm() {
  const [state, formAction] = useActionState(adminAddOutOfOfficeAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="label">Program</span>
        <select name="program_name" className="field mt-1.5" required>
          <ProgramSelectOptions />
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
        <span className="label">Note</span>
        <textarea
          name="reason"
          className="field mt-1.5 min-h-20"
          placeholder="Optional note, such as conference, PTO, or OOO."
        />
      </label>
      <SubmitButton>
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        Add OOO
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
