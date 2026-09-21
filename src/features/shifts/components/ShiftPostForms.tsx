"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, Send } from "lucide-react";
import {
  employeePostShiftAction,
  supervisorPostShiftAction
} from "@/app/actions";
import {
  FIXED_EMERGENCY_PAY_RATE,
  FIXED_STANDARD_PAY_RATE,
  LOCATIONS,
  PROGRAMS,
  SHIFT_EXCHANGE_PROGRAMS,
  SKILLS
} from "@/shared/lib/constants";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
import type { AppRole, ProgramName } from "@/shared/types/domain";

const initialState = { ok: false, message: "" };

export function EmployeeCoveragePostForm({
  programNames
}: {
  programNames: ProgramName[];
}) {
  const [state, formAction] = useActionState(employeePostShiftAction, initialState);
  const eligibleProgramNames = programNames.filter((program) =>
    SHIFT_EXCHANGE_PROGRAMS.includes(program)
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="rounded-lg border border-harbor-sky/20 bg-harbor-mist p-3 text-sm leading-6 text-harbor-midnight/70">
        Employee postings use a fixed ${FIXED_STANDARD_PAY_RATE.toFixed(2)} hourly
        rate. Emergency status is reserved for supervisors and admins.
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Program</span>
          <select name="program_name" className="field mt-1.5" required>
            {eligibleProgramNames.map((program) => (
              <option key={program} value={program}>
                {program}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Location</span>
          <select name="location_name" className="field mt-1.5" required>
            {LOCATIONS.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Date</span>
          <input name="shift_date" type="date" className="field mt-1.5" required />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Start time</span>
          <input name="start_time" type="time" className="field mt-1.5" required />
        </label>
        <label className="block">
          <span className="label">End time</span>
          <input name="end_time" type="time" className="field mt-1.5" required />
        </label>
      </div>
      <label className="block">
        <span className="label">Reason for coverage</span>
        <textarea
          name="details"
          className="field mt-1.5 min-h-24"
          placeholder="Briefly share why this shift is being put up for coverage."
          required
        />
      </label>
      <SubmitButton>
        <Send className="h-4 w-4" aria-hidden="true" />
        Post for coverage
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}

export function SupervisorShiftPostForm({ role = "supervisor" }: { role?: AppRole }) {
  const [category, setCategory] = useState<"standard" | "emergency">("standard");
  const [state, formAction] = useActionState(supervisorPostShiftAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="role" value={role} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Shift title</span>
          <input
            name="title"
            className="field mt-1.5"
            placeholder="Overnight direct care coverage"
            required
          />
        </label>
        <label className="block">
          <span className="label">Program</span>
          <select name="program_name" className="field mt-1.5" required>
            {PROGRAMS.map((program) => (
              <option key={program} value={program}>
                {program}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Location</span>
          <select name="location_name" className="field mt-1.5" required>
            {LOCATIONS.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label">Date</span>
          <input name="shift_date" type="date" className="field mt-1.5" required />
        </label>
        <label className="block">
          <span className="label">Start</span>
          <input name="start_time" type="time" className="field mt-1.5" required />
        </label>
        <label className="block">
          <span className="label">End</span>
          <input name="end_time" type="time" className="field mt-1.5" required />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="label">Openings</span>
          <input
            name="openings"
            type="number"
            min="1"
            max="20"
            defaultValue="1"
            className="field mt-1.5"
            required
          />
        </label>
        <label className="block">
          <span className="label">Category</span>
          <select
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value as "standard" | "emergency")}
            className="field mt-1.5"
          >
            <option value="standard">
              Standard (${FIXED_STANDARD_PAY_RATE.toFixed(2)} hourly)
            </option>
            <option value="emergency">
              Emergency (${FIXED_EMERGENCY_PAY_RATE.toFixed(2)} hourly)
            </option>
          </select>
        </label>
        <div className="rounded-lg border border-harbor-ocean/10 bg-harbor-mist px-3 py-2.5">
          <p className="label">Rate</p>
          <p className="mt-1 text-sm font-medium text-harbor-midnight">
            $
            {(category === "emergency"
              ? FIXED_EMERGENCY_PAY_RATE
              : FIXED_STANDARD_PAY_RATE
            ).toFixed(2)}{" "}
            hourly
          </p>
        </div>
      </div>

      <fieldset>
        <legend className="label">Requirements</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SKILLS.map((skill) => (
            <label
              key={skill}
              className="flex items-center gap-2 rounded-lg border border-harbor-ocean/10 bg-white px-3 py-2 text-sm text-harbor-midnight/75"
            >
              <input
                name="requirements"
                type="checkbox"
                value={skill}
                className="h-4 w-4 rounded border-harbor-ocean/20 text-harbor-sky"
              />
              {skill}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 rounded-lg border border-harbor-ocean/10 bg-harbor-mist px-3 py-2 text-sm text-harbor-midnight/75">
        <input
          name="urgent"
          type="checkbox"
          className="h-4 w-4 rounded border-harbor-ocean/20 text-harbor-sky"
        />
        Mark as urgent
      </label>

      <label className="block">
        <span className="label">Shift details</span>
        <textarea
          name="details"
          className="field mt-1.5 min-h-24"
          placeholder="Include staffing notes, requirements, or context."
          required
        />
      </label>

      <SubmitButton>
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        Post available shift
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}
