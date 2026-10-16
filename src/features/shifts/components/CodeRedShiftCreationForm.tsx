"use client";

import { useActionState } from "react";
import { CalendarPlus } from "lucide-react";
import { addCodeRedShiftsAction } from "@/app/actions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";
import { todayEasternISO } from "@/shared/lib/dates";
import { CODE_RED_SHIFT_TEMPLATES } from "@/shared/lib/shift-templates";

const initialState = { ok: false, message: "" };

export function CodeRedShiftCreationForm() {
  const [state, formAction] = useActionState(addCodeRedShiftsAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm leading-6 text-harbor-midnight/65">
        Choose a date and the Code Red/Code Blue shifts that need coverage. Staff can request each shift after you publish it.
      </p>

      <label className="block">
        <span className="label">Coverage date</span>
        <input name="shift_date" type="date" min={todayEasternISO()} defaultValue={todayEasternISO()} className="field mt-1.5" required />
      </label>

      <fieldset>
        <legend className="label">Shifts to add</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CODE_RED_SHIFT_TEMPLATES.map((template) => (
            <label key={template.slug} className="flex items-start gap-2 rounded-lg border border-harbor-ocean/10 bg-white px-3 py-2 text-sm text-harbor-midnight/75">
              <input
                type="checkbox"
                name="template_slugs"
                value={template.slug}
                className="mt-0.5 h-4 w-4 rounded border-harbor-ocean/20 text-harbor-sky"
              />
              <span>{template.title.replace("Code Red/Code Blue ", "")}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <p className="text-xs text-harbor-midnight/55">Each published shift runs 10:30 AM–5:30 PM and has two coverage slots.</p>

      <SubmitButton>
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        Publish shifts
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}
