"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, Check, X } from "lucide-react";
import {
  adminAddOutOfOfficeAction,
  addOceanAcademyBlackoutAction,
  rescindPendingTimeOffRequestAction,
  submitTimeOffRequestAction,
  updateTimeOffRequestStatusAction
} from "@/app/actions";
import { getProgramLabel } from "@/shared/lib/constants";
import { formatShortDate } from "@/shared/lib/dates";
import { hasTeamTimeOffCoordination, overlappingTeamTimeOffDates, teamTimeOffSelectionKey, type TeamTimeOffDate } from "@/shared/lib/team-time-off";
import { ProgramSelectOptions } from "@/shared/components/ProgramSelectOptions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
import type { AppRole, OceanAcademyBlackout, ProgramName, TimeOffRequest } from "@/shared/types/domain";

const initialState = { ok: false, message: "" };

export function RescindTimeOffRequestControl({ requestId }: { requestId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState(rescindPendingTimeOffRequestAction, initialState);

  return (
    <div className="mt-3">
      {!confirming && !state.ok ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="word-button text-red-700"
        >
          Rescind request
        </button>
      ) : null}
      {confirming && !state.ok ? (
        <form action={action} className="rounded-lg border border-red-200 bg-red-50 p-3">
          <input type="hidden" name="request_id" value={requestId} />
          <p className="text-sm text-red-900">Rescind this pending time off request?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SubmitButton variant="secondary" className="!px-3 !py-1.5 !text-sm">
              Confirm rescind
            </SubmitButton>
            <button type="button" onClick={() => setConfirming(false)} className="word-button">
              Keep request
            </button>
          </div>
        </form>
      ) : null}
      <ActionFeedback state={state} />
    </div>
  );
}

export function TimeOffRequestForm({
  programNames,
  initialStartDate = "",
  initialProgramName,
  teamTimeOffDates = [],
  blackouts = [],
  teamAvailabilityAvailable = true
}: {
  programNames: ProgramName[];
  initialStartDate?: string;
  initialProgramName?: ProgramName;
  teamTimeOffDates?: TeamTimeOffDate[];
  blackouts?: OceanAcademyBlackout[];
  teamAvailabilityAvailable?: boolean;
}) {
  const [state, formAction] = useActionState(
    submitTimeOffRequestAction,
    initialState as Awaited<ReturnType<typeof submitTimeOffRequestAction>>
  );
  const [programName, setProgramName] = useState<ProgramName | "">(() =>
    initialProgramName && programNames.includes(initialProgramName)
      ? initialProgramName
      : programNames.length === 1 ? programNames[0] : ""
  );
  const [startDate, setStartDate] = useState(initialStartDate);
  const [multipleDays, setMultipleDays] = useState(false);
  const [endDate, setEndDate] = useState("");
  const selectedEndDate = multipleDays ? endDate : startDate;
  const [spokeWithSupervisor, setSpokeWithSupervisor] = useState(false);
  const [specialApprovalConfirmed, setSpecialApprovalConfirmed] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [dismissedConflictKey, setDismissedConflictKey] = useState<string | null>(null);
  const selectionKey = teamTimeOffSelectionKey(programName, startDate, selectedEndDate);
  const calendarConflicts = overlappingTeamTimeOffDates(teamTimeOffDates, programName, startDate, selectedEndDate);
  const newlyDetectedConflicts = state.conflictKey === selectionKey ? state.conflictDates ?? [] : [];
  const conflictDates = [...new Set([...calendarConflicts, ...newlyDetectedConflicts])].sort();
  const blackoutDates = programName === "Ocean Academy"
    ? blackouts.filter((item) => item.start_date <= selectedEndDate && item.end_date >= startDate)
    : [];
  const lateBlackoutDates = state.conflictKey === selectionKey ? state.blackoutDates ?? [] : [];
  const hasOceanConflict = programName === "Ocean Academy" && (conflictDates.length > 0 || blackoutDates.length > 0 || lateBlackoutDates.length > 0);
  const needsTeamCheck = hasTeamTimeOffCoordination(programName);
  const visibleState = state.conflictKey && state.conflictKey !== selectionKey ? initialState : state;
  const lateConflictOpen = !state.ok && state.conflictKey === selectionKey && hasOceanConflict &&
    dismissedConflictKey !== selectionKey;
  const conflictModalOpen = !(state.ok && state.conflictKey === selectionKey) &&
    (showConflictModal || lateConflictOpen);

  if (programNames.length === 0) {
    return <p className="rounded-lg border border-harbor-ocean/15 bg-harbor-mist p-4 text-sm text-harbor-midnight/75">
      Your account is ready to use. You can request time off once your first program assignment is approved.
    </p>;
  }

  return (
    <form action={formAction} className="space-y-4" onSubmit={(event) => {
      if (hasOceanConflict && !specialApprovalConfirmed) {
        event.preventDefault();
        setShowConflictModal(true);
      }
    }}>
      <input type="hidden" name="special_approval_requested" value={hasOceanConflict && specialApprovalConfirmed ? "true" : "false"} />
      <label className="block">
        <span className="label">Program</span>
        <select
          name="program_name"
          value={programName}
          onChange={(event) => {
            setProgramName(event.target.value as ProgramName);
            setSpokeWithSupervisor(false);
            setSpecialApprovalConfirmed(false);
            setShowConflictModal(false);
            setDismissedConflictKey(null);
          }}
          className="field mt-1.5"
          required
        >
          {programNames.length > 1 ? <option value="" disabled>Select a program</option> : null}
          {programNames.map((program) => (
            <option key={program} value={program}>
              {getProgramLabel(program)}
            </option>
          ))}
        </select>
      </label>
      <div className={multipleDays ? "grid gap-3 sm:grid-cols-2" : ""}>
        <label className="block">
          <span className="label">Start date</span>
          <input
            name="start_date"
            type="date"
            value={startDate}
            onChange={(event) => {
              const nextDate = event.target.value;
              setStartDate(nextDate);
              if (multipleDays && endDate && endDate < nextDate) setEndDate("");
              setSpokeWithSupervisor(false);
              setSpecialApprovalConfirmed(false);
              setShowConflictModal(false);
              setDismissedConflictKey(null);
            }}
            className="field mt-1.5"
            required
          />
        </label>
        {multipleDays ? (
          <label className="block">
            <span className="label">End date</span>
            <input
              name="end_date"
              type="date"
              min={startDate || undefined}
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setSpokeWithSupervisor(false);
                setSpecialApprovalConfirmed(false);
                setShowConflictModal(false);
                setDismissedConflictKey(null);
              }}
              className="field mt-1.5"
              required
            />
          </label>
        ) : <input type="hidden" name="end_date" value={startDate} />}
      </div>
      <label className="flex w-fit items-center gap-2 text-sm font-medium text-harbor-midnight">
        <input
          type="checkbox"
          checked={multipleDays}
          onChange={(event) => {
            setMultipleDays(event.target.checked);
            setEndDate("");
            setSpokeWithSupervisor(false);
            setSpecialApprovalConfirmed(false);
            setShowConflictModal(false);
            setDismissedConflictKey(null);
          }}
          className="h-4 w-4 accent-harbor-ocean"
        />
        Multiple days
      </label>
      {needsTeamCheck && !teamAvailabilityAvailable ? (
        <p role="status" className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
          Team availability could not load. Your dates will be checked again when you submit.
        </p>
      ) : null}
      {needsTeamCheck && programName !== "Ocean Academy" && conflictDates.length > 0 ? (
        <div role="alert" className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950">
          <p className="font-semibold">
            A teammate in {getProgramLabel(programName as ProgramName)} is already approved off on {conflictDates.slice(0, 4).map(formatShortDate).join(", ")}
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
      {conflictModalOpen && hasOceanConflict ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-harbor-midnight/60 p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="ocean-conflict-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <p className="label text-orange-700">Ocean Academy</p>
            <h2 id="ocean-conflict-title" className="mt-2 text-xl font-semibold text-harbor-midnight">Special approval required</h2>
            {conflictDates.length > 0 ? <p className="mt-3 text-sm text-harbor-midnight/80">Someone else in Ocean Academy already has approved time off on {conflictDates.slice(0, 4).map(formatShortDate).join(", ")}{conflictDates.length > 4 ? ` and ${conflictDates.length - 4} more date${conflictDates.length === 5 ? "" : "s"}` : ""}.</p> : null}
            {blackoutDates.length > 0 || lateBlackoutDates.length > 0 ? <p className="mt-3 text-sm text-harbor-midnight/80">One or more requested days are Ocean Academy blackout dates.</p> : null}
            <p className="mt-3 text-sm text-harbor-midnight/80">You may choose alternative dates. If you continue, an Ocean Academy supervisor must give special approval before this time off is approved.</p>
            <label className="mt-5 flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm font-medium text-orange-950">
              <input type="checkbox" checked={specialApprovalConfirmed} onChange={(event) => setSpecialApprovalConfirmed(event.target.checked)} className="mt-0.5" />
              <span>I understand someone else may already be off or these dates are blacked out, and this request requires special supervisor approval.</span>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { setShowConflictModal(false); setDismissedConflictKey(selectionKey); }} className="word-button">Choose other dates</button>
              <button type="submit" disabled={!specialApprovalConfirmed} className="primary-button disabled:opacity-50">Submit for special approval</button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

export function OceanAcademyBlackoutForm() {
  const [state, formAction] = useActionState(addOceanAcademyBlackoutAction, initialState);
  return <form action={formAction} className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block"><span className="label">Start date</span><input name="start_date" type="date" className="field mt-1.5" required /></label>
      <label className="block"><span className="label">End date</span><input name="end_date" type="date" className="field mt-1.5" required /></label>
    </div>
    <label className="block"><span className="label">Note</span><textarea name="note" className="field mt-1.5 min-h-20" placeholder="Reason for blackout (optional)" /></label>
    <SubmitButton><CalendarPlus className="h-4 w-4" aria-hidden="true" />Add blackout dates</SubmitButton>
    <ActionFeedback state={state} />
  </form>;
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
