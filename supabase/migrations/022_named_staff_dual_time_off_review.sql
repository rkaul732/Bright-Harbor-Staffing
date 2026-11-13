-- Give both designated Adult Clinical admins the same time-off review access
-- for the nine named staff members, regardless of the request's program.
begin;

create table if not exists public.time_off_review_assignments (
  requester_id uuid not null references public.users(id) on delete cascade,
  reviewer_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (requester_id, reviewer_id),
  constraint time_off_review_assignments_no_self_review check (requester_id <> reviewer_id)
);

alter table public.time_off_review_assignments enable row level security;
revoke all on public.time_off_review_assignments from public, anon, authenticated;
grant select, insert, update, delete on public.time_off_review_assignments to service_role;

do $$
declare
  staff_count integer;
  reviewer_count integer;
begin
  select count(*) into staff_count
  from public.users u
  where lower(u.email) in (
    'nsullivan@brightharbor.org',
    'laurel@brightharbor.org',
    'cnoroski@brightharbor.org',
    'asmith@brightharbor.org',
    'krafter@brightharbor.org',
    'kshalloo@brightharbor.org',
    'kdeleon@brightharbor.org',
    'aminchala@brightharbor.org',
    'bpataky@brightharbor.org'
  );

  select count(*) into reviewer_count
  from public.users u
  join public.admin_profiles ap on ap.user_id = u.id and ap.status = 'approved'
  where lower(u.email) in ('mcorrigan@brightharbor.org', 'mharper@brightharbor.org');

  if staff_count <> 9 or reviewer_count <> 2 then
    raise exception 'Expected nine staff accounts and two approved admin reviewers; found % staff and % reviewers',
      staff_count, reviewer_count;
  end if;
end;
$$;

insert into public.time_off_review_assignments (requester_id, reviewer_id)
select staff.id, reviewer.id
from public.users staff
cross join public.users reviewer
where lower(staff.email) in (
    'nsullivan@brightharbor.org',
    'laurel@brightharbor.org',
    'cnoroski@brightharbor.org',
    'asmith@brightharbor.org',
    'krafter@brightharbor.org',
    'kshalloo@brightharbor.org',
    'kdeleon@brightharbor.org',
    'aminchala@brightharbor.org',
    'bpataky@brightharbor.org'
  )
  and lower(reviewer.email) in ('mcorrigan@brightharbor.org', 'mharper@brightharbor.org')
on conflict do nothing;

create or replace function public.request_review_recipients(
  target_kind text,
  target_program text,
  target_requester_id uuid
)
returns table(user_id uuid, email text, full_name text, role text)
language sql stable security definer set search_path = public as $$
  with override_recipients as (
    select u.id as user_id, u.email, u.full_name, u.role::text as role
    from public.time_off_review_assignments assignment
    join public.users u on u.id = assignment.reviewer_id
    join public.admin_profiles ap on ap.user_id = u.id and ap.status = 'approved'
    where target_kind = 'time-off'
      and assignment.requester_id = target_requester_id
      and u.id is distinct from target_requester_id
      and u.role = 'admin'
      and u.email ~* '^[^@[:space:]]+@brightharbor[.]org$'
  ), requester as (
    select case
      when target_kind = 'shift' then 'employee'
      when coalesce((select u.role::text from public.users u where u.id = target_requester_id), 'employee')
        in ('supervisor', 'admin')
        and exists (
          select 1 from public.supervisor_profiles sp
          where sp.user_id = target_requester_id and sp.status = 'approved'
        )
        and not exists (
          select 1 from public.admin_profiles ap
          where ap.user_id = target_requester_id and ap.status = 'approved' and ap.is_super_admin
        ) then 'supervisor'
      else coalesce((select u.role::text from public.users u where u.id = target_requester_id), 'employee')
    end as requester_role
  ), candidates as (
    select u.id, u.email, u.full_name, u.role::text as app_role,
      exists (
        select 1 from public.supervisor_profiles sp
        where sp.user_id = u.id and sp.status = 'approved'
          and public.reviewer_scope_includes_program(target_program, sp.program_names)
      ) as assigned_supervisor,
      exists (
        select 1 from public.admin_profiles ap
        where ap.user_id = u.id and ap.status = 'approved'
          and public.reviewer_scope_includes_program(target_program, ap.program_names)
      ) as assigned_admin,
      exists (
        select 1 from public.admin_profiles ap
        where ap.user_id = u.id and ap.status = 'approved' and ap.is_super_admin
      ) as super_admin
    from public.users u
    where u.id is distinct from target_requester_id
      and u.email ~* '^[^@[:space:]]+@brightharbor[.]org$'
  ), ranked as (
    select c.*,
      case
        when r.requester_role = 'admin' then
          case when c.app_role = 'admin' and c.super_admin then 1 else 99 end
        when r.requester_role = 'supervisor' then
          case when c.app_role = 'admin' and c.assigned_admin then 1
               when c.app_role = 'admin' and c.super_admin then 2 else 99 end
        else
          case when c.app_role = 'supervisor' and c.assigned_supervisor then 1
               when c.app_role = 'admin' and c.assigned_supervisor then 2
               when c.app_role = 'admin' and c.assigned_admin then 3
               when c.app_role = 'admin' and c.super_admin then 4 else 99 end
      end as priority
    from candidates c cross join requester r
  )
  select assigned.user_id, assigned.email, assigned.full_name, assigned.role
  from override_recipients assigned
  union all
  select ranked.id, ranked.email, ranked.full_name, ranked.app_role
  from ranked
  where ranked.priority < 99
    and ranked.priority = (select min(other.priority) from ranked other)
    and not exists (select 1 from override_recipients)
  order by full_name, user_id
$$;

revoke all on function public.request_review_recipients(text, text, uuid) from public, anon, authenticated;
grant execute on function public.request_review_recipients(text, text, uuid) to service_role;

-- The queue includes completed requests only for these explicitly assigned
-- reviewers, so they can correct a past approval or denial.
create or replace function public.current_reviewable_time_off_request_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(t.id order by t.created_at desc), '{}'::uuid[])
  from public.time_off_requests t
  where (
      t.status = 'pending_supervisor_approval'
      or (
        t.status in ('approved', 'declined')
        and exists (
          select 1 from public.time_off_review_assignments assignment
          where assignment.requester_id = t.user_id
            and assignment.reviewer_id = auth.uid()
        )
      )
    )
    and public.current_reviewer_can_decide_time_off(t.user_id, t.program_name)
$$;

revoke all on function public.current_reviewable_time_off_request_ids() from public, anon;
grant execute on function public.current_reviewable_time_off_request_ids() to authenticated;

-- Bring the existing pending request into both reviewers' in-app inboxes.
insert into public.notifications (user_id, role, title, body, request_kind, request_id)
select recipient.user_id, recipient.role,
  'Time off approval needed',
  t.employee_name || ' submitted a time off request for ' || t.program_name || '.',
  'time-off', t.id
from public.time_off_requests t
cross join lateral public.request_review_recipients('time-off', t.program_name, t.user_id) recipient
where t.status = 'pending_supervisor_approval'
  and exists (
    select 1 from public.time_off_review_assignments assignment
    where assignment.requester_id = t.user_id
  )
on conflict do nothing;

commit;
