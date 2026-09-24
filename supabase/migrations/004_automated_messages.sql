do $$
begin
  if not exists (select 1 from pg_type where typname = 'automated_message_event') then
    create type public.automated_message_event as enum (
      'time_off_approved',
      'time_off_declined'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'automated_email_status') then
    create type public.automated_email_status as enum ('queued', 'sent', 'failed');
  end if;
end $$;

create table if not exists public.automated_message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_type public.automated_message_event not null,
  program_names text[] not null default '{}',
  subject text not null,
  body_html text not null,
  active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint automated_message_subject_not_blank check (char_length(trim(subject)) > 0),
  constraint automated_message_body_not_blank check (char_length(trim(body_html)) > 0)
);

create table if not exists public.automated_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.automated_message_templates(id) on delete set null,
  request_id uuid references public.time_off_requests(id) on delete set null,
  event_type public.automated_message_event not null,
  program_name text not null,
  recipient_user_id uuid references public.users(id) on delete set null,
  recipient_email text not null,
  recipient_name text not null,
  subject text not null,
  body_html text not null,
  status public.automated_email_status not null default 'queued',
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists automated_message_templates_event_idx
on public.automated_message_templates (event_type, active);

create index if not exists automated_message_templates_programs_idx
on public.automated_message_templates using gin (program_names);

create index if not exists automated_email_deliveries_status_idx
on public.automated_email_deliveries (status, created_at);

drop trigger if exists automated_message_templates_touch_updated_at on public.automated_message_templates;

create trigger automated_message_templates_touch_updated_at
before update on public.automated_message_templates
for each row execute function public.touch_updated_at();

alter table public.automated_message_templates enable row level security;
alter table public.automated_email_deliveries enable row level security;

drop policy if exists "automated messages visible to scoped reviewers" on public.automated_message_templates;
drop policy if exists "automated messages managed by super admins" on public.automated_message_templates;
drop policy if exists "automated email deliveries visible to super admins" on public.automated_email_deliveries;
drop policy if exists "automated email deliveries inserted by reviewers" on public.automated_email_deliveries;
drop policy if exists "automated email deliveries managed by super admins" on public.automated_email_deliveries;

create policy "automated messages visible to scoped reviewers"
on public.automated_message_templates for select
to authenticated
using (
  active = true
  and (
    public.current_app_role() = 'supervisor'
    or public.current_admin_is_super_admin()
    or program_names = '{}'::text[]
    or program_names && public.current_admin_program_names()
  )
);

create policy "automated messages managed by super admins"
on public.automated_message_templates for all
to authenticated
using (public.current_admin_is_super_admin())
with check (public.current_admin_is_super_admin());

create policy "automated email deliveries visible to super admins"
on public.automated_email_deliveries for select
to authenticated
using (public.current_admin_is_super_admin());

create policy "automated email deliveries inserted by reviewers"
on public.automated_email_deliveries for insert
to authenticated
with check (
  public.current_app_role() = 'supervisor'
  or public.current_admin_can_access_program(program_name)
);

create policy "automated email deliveries managed by super admins"
on public.automated_email_deliveries for update
to authenticated
using (public.current_admin_is_super_admin())
with check (public.current_admin_is_super_admin());

insert into public.automated_message_templates (
  name,
  event_type,
  program_names,
  subject,
  body_html,
  active
)
select
  'Time off approved',
  'time_off_approved',
  '{}'::text[],
  'Time off request approved for {{start_date}}',
  '<p>Hello {{employee_name}},</p><p>Your time off request for <strong>{{program_name}}</strong> from {{start_date}} to {{end_date}} has been <strong>approved</strong>.</p><p>{{review_comment}}</p>',
  true
where not exists (
  select 1
  from public.automated_message_templates
  where name = 'Time off approved'
    and event_type = 'time_off_approved'
);

insert into public.automated_message_templates (
  name,
  event_type,
  program_names,
  subject,
  body_html,
  active
)
select
  'Time off declined',
  'time_off_declined',
  '{}'::text[],
  'Time off request update for {{start_date}}',
  '<p>Hello {{employee_name}},</p><p>Your time off request for <strong>{{program_name}}</strong> from {{start_date}} to {{end_date}} has been <strong>declined</strong>.</p><p>{{review_comment}}</p>',
  true
where not exists (
  select 1
  from public.automated_message_templates
  where name = 'Time off declined'
    and event_type = 'time_off_declined'
);
