"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  CheckCircle2,
  Italic,
  MailCheck,
  Paintbrush,
  Plus,
  Save,
  Type,
  Underline
} from "lucide-react";
import { saveAutomatedMessageTemplateAction } from "@/app/actions";
import { PROGRAMS } from "@/shared/lib/constants";
import { ActionFeedback } from "@/shared/components/ActionFeedback";
import { EmptyState } from "@/shared/components/EmptyState";
import { SubmitButton } from "@/shared/components/SubmitButton";
import { cn } from "@/shared/lib/cn";
import { formatShortDate } from "@/shared/lib/dates";
import type {
  AutomatedEmailDelivery,
  AutomatedMessageEvent,
  AutomatedMessageTemplate,
  ProgramName
} from "@/shared/types/domain";

type DraftTemplate = {
  id: string;
  name: string;
  event_type: AutomatedMessageEvent;
  subject: string;
  body_html: string;
  program_names: ProgramName[];
  active: boolean;
};

const initialState = { ok: false, message: "" };
const blankTemplate: DraftTemplate = {
  id: "",
  name: "",
  event_type: "time_off_approved",
  subject: "Time off request {{status}} for {{start_date}}",
  body_html:
    "<p>Hello {{employee_name}},</p><p>Your time off request for <strong>{{program_name}}</strong> from {{start_date}} to {{end_date}} has been <strong>{{status}}</strong>.</p><p>{{review_comment}}</p>",
  program_names: [],
  active: true
};
const tokenNames = [
  "employee_name",
  "program_name",
  "start_date",
  "end_date",
  "status",
  "review_comment",
  "reviewer_name"
];
const fontOptions = ["Inter", "Arial", "Georgia", "Times New Roman", "Verdana"];

function eventLabel(eventType: AutomatedMessageEvent) {
  return eventType === "time_off_approved" ? "Time off approved" : "Time off declined";
}

function templateToDraft(template: AutomatedMessageTemplate): DraftTemplate {
  return {
    id: template.id,
    name: template.name,
    event_type: template.event_type,
    subject: template.subject,
    body_html: template.body_html,
    program_names: template.program_names,
    active: template.active
  };
}

function defaultDraftForEvent(eventType: AutomatedMessageEvent) {
  return {
    ...blankTemplate,
    event_type: eventType,
    name: eventLabel(eventType),
    subject:
      eventType === "time_off_approved"
        ? "Time off request approved for {{start_date}}"
        : "Time off request update for {{start_date}}"
  };
}

function programSummary(programNames: ProgramName[]) {
  if (programNames.length === 0) {
    return "All programs";
  }

  if (programNames.length === 1) {
    return programNames[0];
  }

  return programNames.length + " programs";
}

function deliveryStatusClass(status: AutomatedEmailDelivery["status"]) {
  if (status === "sent") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (status === "failed") {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }

  return "bg-harbor-mist text-harbor-ocean border-harbor-sky/20";
}

function ToolbarButton({
  label,
  icon: Icon,
  onClick
}: {
  label: string;
  icon: typeof Bold;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md text-harbor-ocean transition hover:bg-harbor-mist hover:text-harbor-midnight"
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export function AutomatedMessagesDashboard({
  templates,
  deliveries,
  isConfigured
}: {
  templates: AutomatedMessageTemplate[];
  deliveries: AutomatedEmailDelivery[];
  isConfigured: boolean;
}) {
  const [state, formAction] = useActionState(saveAutomatedMessageTemplateAction, initialState);
  const [draft, setDraft] = useState<DraftTemplate>(
    templates[0] ? templateToDraft(templates[0]) : defaultDraftForEvent("time_off_approved")
  );
  const editorRef = useRef<HTMLDivElement | null>(null);
  const allPrograms = draft.program_names.length === 0;

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== draft.body_html) {
      editorRef.current.innerHTML = draft.body_html;
    }
  }, [draft]);

  const activeTemplates = useMemo(
    () => templates.filter((template) => template.active).length,
    [templates]
  );

  function updateDraft(update: Partial<DraftTemplate>) {
    setDraft((current) => ({ ...current, ...update }));
  }

  function applyCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    updateDraft({ body_html: editorRef.current?.innerHTML ?? draft.body_html });
  }

  function insertToken(token: string) {
    applyCommand("insertText", "{{" + token + "}}");
  }

  function toggleProgram(program: ProgramName, checked: boolean) {
    updateDraft({
      program_names: checked
        ? [...draft.program_names, program]
        : draft.program_names.filter((item) => item !== program)
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-harbor-ocean/10 bg-white/95 p-5 shadow-soft sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="label text-harbor-sky">Super admin</p>
            <h1 className="mt-2 text-3xl font-medium text-harbor-midnight sm:text-4xl">
              Automated Messages
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-harbor-midnight/65">
              Manage the email wording sent after time off requests are approved or declined.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-80">
            <div className="rounded-lg border border-harbor-ocean/10 bg-harbor-mist/70 p-3">
              <p className="text-2xl font-medium text-harbor-midnight">{templates.length}</p>
              <p className="label mt-1">Templates</p>
            </div>
            <div className="rounded-lg border border-harbor-ocean/10 bg-harbor-mist/70 p-3">
              <p className="text-2xl font-medium text-harbor-midnight">{activeTemplates}</p>
              <p className="label mt-1">Active</p>
            </div>
          </div>
        </div>

        {!isConfigured ? (
          <div className="mt-5 rounded-lg border border-harbor-sky/20 bg-harbor-mist px-3 py-3 text-sm text-harbor-midnight/70">
            Demo templates are shown because the automated message tables are not available yet.
          </div>
        ) : null}
      </section>

      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="panel p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="label">Message library</p>
              <h2 className="mt-1 text-xl font-medium text-harbor-midnight">Templates</h2>
            </div>
            <button
              type="button"
              onClick={() => setDraft(defaultDraftForEvent("time_off_approved"))}
              className="word-button font-semibold"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {templates.length > 0 ? (
              templates.map((template) => {
                const active = draft.id === template.id;

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setDraft(templateToDraft(template))}
                    className={cn(
                      "focus-ring w-full rounded-lg border p-3 text-left transition",
                      active
                        ? "border-harbor-sky bg-harbor-mist"
                        : "border-harbor-ocean/10 bg-white hover:border-harbor-sky/40"
                    )}
                  >
                    <span className="block text-sm font-medium text-harbor-midnight">
                      {template.name}
                    </span>
                    <span className="mt-1 block text-xs text-harbor-midnight/55">
                      {eventLabel(template.event_type)} • {programSummary(template.program_names)}
                    </span>
                    <span
                      className={cn(
                        "mt-3 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                        template.active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-harbor-ocean/10 bg-white text-harbor-midnight/50"
                      )}
                    >
                      {template.active ? "Active" : "Paused"}
                    </span>
                  </button>
                );
              })
            ) : (
              <EmptyState
                icon={MailCheck}
                title="No templates yet"
                body="Create the first automated message for time off approvals or denials."
              />
            )}
          </div>
        </aside>

        <section className="panel p-4 sm:p-5">
          <form action={formAction} className="space-y-5">
            <input type="hidden" name="template_id" value={draft.id} />
            <input type="hidden" name="body_html" value={draft.body_html} />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="label">Editor</p>
                <h2 className="mt-1 text-xl font-medium text-harbor-midnight">
                  {draft.id ? "Edit message" : "Create message"}
                </h2>
              </div>
              <label className="flex items-center gap-2 text-sm text-harbor-midnight/70">
                <input
                  type="checkbox"
                  name="active"
                  checked={draft.active}
                  onChange={(event) => updateDraft({ active: event.target.checked })}
                  className="h-4 w-4 rounded border-harbor-ocean/20 text-harbor-sky"
                />
                Active
              </label>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <label className="block">
                <span className="label">Message name</span>
                <input
                  name="name"
                  value={draft.name}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                  className="field mt-1.5"
                  placeholder="Time off approved"
                  required
                />
              </label>
              <label className="block">
                <span className="label">When this sends</span>
                <select
                  name="event_type"
                  value={draft.event_type}
                  onChange={(event) =>
                    updateDraft({ event_type: event.target.value as AutomatedMessageEvent })
                  }
                  className="field mt-1.5"
                >
                  <option value="time_off_approved">Time off approved</option>
                  <option value="time_off_declined">Time off declined</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="label">Email subject</span>
              <input
                name="subject"
                value={draft.subject}
                onChange={(event) => updateDraft({ subject: event.target.value })}
                className="field mt-1.5"
                required
              />
            </label>

            <fieldset>
              <legend className="label">Program assignment</legend>
              <label className="mt-2 flex items-center gap-2 rounded-lg border border-harbor-ocean/10 bg-harbor-mist/70 px-3 py-2 text-sm text-harbor-midnight/75">
                <input
                  type="checkbox"
                  checked={allPrograms}
                  onChange={(event) => {
                    updateDraft({
                      program_names: event.target.checked ? [] : [PROGRAMS[0]]
                    });
                  }}
                  className="h-4 w-4 rounded border-harbor-ocean/20 text-harbor-sky"
                />
                All programs
              </label>
              {!allPrograms ? (
                <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-harbor-ocean/10 bg-white p-2">
                  <div className="grid gap-2 md:grid-cols-2">
                    {PROGRAMS.map((program) => (
                      <label
                        key={program}
                        className="flex items-start gap-2 rounded-md px-2 py-2 text-sm text-harbor-midnight/75 hover:bg-harbor-mist"
                      >
                        <input
                          type="checkbox"
                          name="program_names"
                          value={program}
                          checked={draft.program_names.includes(program)}
                          onChange={(event) => toggleProgram(program, event.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-harbor-ocean/20 text-harbor-sky"
                        />
                        <span>{program}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </fieldset>

            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="label">Message body</span>
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-harbor-ocean/10 bg-white p-1 shadow-line">
                  <ToolbarButton label="Bold" icon={Bold} onClick={() => applyCommand("bold")} />
                  <ToolbarButton label="Italic" icon={Italic} onClick={() => applyCommand("italic")} />
                  <ToolbarButton label="Underline" icon={Underline} onClick={() => applyCommand("underline")} />
                  <label className="focus-ring inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-harbor-ocean transition hover:bg-harbor-mist hover:text-harbor-midnight" title="Text color">
                    <Paintbrush className="h-4 w-4" aria-hidden="true" />
                    <input
                      type="color"
                      className="sr-only"
                      onChange={(event) => applyCommand("foreColor", event.target.value)}
                    />
                  </label>
                  <label className="inline-flex items-center gap-1 rounded-md px-1.5 text-harbor-ocean">
                    <Type className="h-4 w-4" aria-hidden="true" />
                    <select
                      className="bg-transparent text-xs outline-none"
                      onChange={(event) => applyCommand("fontName", event.target.value)}
                      defaultValue=""
                      aria-label="Font"
                    >
                      <option value="" disabled>Font</option>
                      {fontOptions.map((font) => (
                        <option key={font} value={font}>{font}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(event) => updateDraft({ body_html: event.currentTarget.innerHTML })}
                className="focus-ring mt-2 min-h-60 rounded-lg border border-harbor-ocean/15 bg-white px-4 py-3 text-sm leading-6 text-harbor-midnight outline-none"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {tokenNames.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insertToken(token)}
                    className="rounded-full border border-harbor-sky/20 bg-harbor-mist px-2.5 py-1 text-xs font-medium text-harbor-ocean transition hover:bg-white"
                  >
                    {"{{" + token + "}}"}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-harbor-ocean/10 bg-harbor-mist/55 p-4">
              <p className="label">Preview</p>
              <p className="mt-2 text-sm font-medium text-harbor-midnight">{draft.subject}</p>
              <div
                className="mt-3 rounded-lg bg-white p-3 text-sm leading-6 text-harbor-midnight/75"
                dangerouslySetInnerHTML={{ __html: draft.body_html }}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <ActionFeedback state={state} />
              <SubmitButton className="sm:min-w-44">
                <Save className="h-4 w-4" aria-hidden="true" />
                Save message
              </SubmitButton>
            </div>
          </form>
        </section>
      </div>

      <section className="panel p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="label">Delivery log</p>
            <h2 className="mt-1 text-xl font-medium text-harbor-midnight">Recent automated emails</h2>
          </div>
          <CheckCircle2 className="h-5 w-5 text-harbor-ocean" aria-hidden="true" />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {deliveries.length > 0 ? (
            deliveries.map((delivery) => (
              <article key={delivery.id} className="rounded-lg border border-harbor-ocean/10 bg-white p-3 shadow-line">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-harbor-midnight">{delivery.subject}</p>
                    <p className="mt-1 truncate text-xs text-harbor-midnight/55">
                      {delivery.recipient_name} • {delivery.recipient_email}
                    </p>
                  </div>
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", deliveryStatusClass(delivery.status))}>
                    {delivery.status}
                  </span>
                </div>
                <p className="mt-3 text-xs text-harbor-midnight/55">
                  {eventLabel(delivery.event_type)} • {delivery.program_name} • {formatShortDate(delivery.created_at.slice(0, 10))}
                </p>
              </article>
            ))
          ) : (
            <EmptyState
              icon={MailCheck}
              title="No emails queued yet"
              body="Approved or declined time off requests will create delivery records here."
            />
          )}
        </div>
      </section>
    </div>
  );
}
