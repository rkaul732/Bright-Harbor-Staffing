"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteEmployeeAccountAction } from "@/app/actions";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { SubmitButton } from "@/shared/components/SubmitButton";

const initialState = { ok: false, message: "" };

export function DeleteEmployeeControl({
  userId,
  name,
  email
}: {
  userId: string;
  name: string;
  email: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(deleteEmployeeAccountAction, initialState);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [router, state.ok]);

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline"
        aria-expanded={open}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        Delete employee
      </button>

      {open ? (
        <form action={formAction} className="mt-3 max-w-sm rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-normal text-harbor-midnight">
          <input type="hidden" name="user_id" value={userId} />
          <p className="font-semibold">Delete {name}?</p>
          <p className="mt-1 leading-5">This permanently removes sign-in access and hides the employee from active lists. Staffing history remains. This cannot be undone.</p>
          <label className="mt-3 block font-medium" htmlFor={`delete-confirm-${userId}`}>
            Type {email} to confirm
          </label>
          <input
            id={`delete-confirm-${userId}`}
            name="confirmation_email"
            type="email"
            autoComplete="off"
            className="field mt-1 w-full"
            required
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SubmitButton className="!bg-red-700 hover:!bg-red-800">Delete account</SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className="word-button">Cancel</button>
          </div>
          <ActionFeedback state={state} />
        </form>
      ) : null}
    </div>
  );
}
