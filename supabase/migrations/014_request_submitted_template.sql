insert into public.automated_message_templates (
  name,
  event_type,
  program_names,
  subject,
  body_html,
  active
)
select
  'Your Request Has Been Submitted',
  'request_submitted',
  '{}'::text[],
  'Your Request Has Been Submitted',
  '<p>Hello {{employee_name}},</p><p>Your {{request_kind}} request was successfully submitted on <strong>{{submitted_at}}</strong>.</p><p><strong>Request Summary</strong><br>{{request_summary}}</p><p>Your request is awaiting review. We will email you when a decision is made.</p>',
  true
where not exists (
  select 1
  from public.automated_message_templates
  where event_type = 'request_submitted'
    and name = 'Your Request Has Been Submitted'
);
