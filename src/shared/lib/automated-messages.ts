import { isSupabaseConfigured } from "@/shared/lib/supabase/env";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import type {
  AutomatedEmailDelivery,
  AutomatedMessageTemplate
} from "@/shared/types/domain";

const demoTemplates: AutomatedMessageTemplate[] = [
  {
    id: "demo-submitted-template",
    name: "Your Request Has Been Submitted",
    event_type: "request_submitted",
    program_names: [],
    subject: "Your Request Has Been Submitted",
    body_html: "<p>Hello {{employee_name}},</p><p>Your {{request_kind}} request was successfully submitted on <strong>{{submitted_at}}</strong>.</p><p><strong>Request summary</strong><br>{{request_summary}}</p><p>Your request is awaiting review. We will email you when a decision is made.</p>",
    active: true,
    created_by: null,
    updated_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "demo-approved-template",
    name: "Time off approved",
    event_type: "time_off_approved",
    program_names: [],
    subject: "Time off request approved for {{start_date}}",
    body_html:
      "<p>Hello {{employee_name}},</p><p>Your time off request for <strong>{{program_name}}</strong> from {{start_date}} to {{end_date}} has been <strong>approved</strong>.</p><p>{{review_comment}}</p>",
    active: true,
    created_by: null,
    updated_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "demo-declined-template",
    name: "Time off declined",
    event_type: "time_off_declined",
    program_names: [],
    subject: "Time off request update for {{start_date}}",
    body_html:
      "<p>Hello {{employee_name}},</p><p>Your time off request for <strong>{{program_name}}</strong> from {{start_date}} to {{end_date}} has been <strong>declined</strong>.</p><p>{{review_comment}}</p>",
    active: true,
    created_by: null,
    updated_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export type AutomatedMessagesData = {
  templates: AutomatedMessageTemplate[];
  deliveries: AutomatedEmailDelivery[];
  isConfigured: boolean;
};

function normalizeTemplate(template: AutomatedMessageTemplate): AutomatedMessageTemplate {
  return {
    ...template,
    program_names: Array.isArray(template.program_names) ? template.program_names : []
  };
}

export async function getAutomatedMessagesData(): Promise<AutomatedMessagesData> {
  if (!isSupabaseConfigured()) {
    return {
      templates: demoTemplates,
      deliveries: [],
      isConfigured: false
    };
  }

  const supabase = await createSupabaseServerClient();
  const [templatesResult, deliveriesResult] = await Promise.all([
    supabase
      .from("automated_message_templates")
      .select("*")
      .order("updated_at", { ascending: false }),
    supabase
      .from("automated_email_deliveries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(12)
  ]);

  return {
    templates: ((templatesResult.data ?? []) as AutomatedMessageTemplate[]).map(normalizeTemplate),
    deliveries: (deliveriesResult.data ?? []) as AutomatedEmailDelivery[],
    isConfigured: !templatesResult.error
  };
}
