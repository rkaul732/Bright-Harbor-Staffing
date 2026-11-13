-- Keep the program supervisor on employee time-off requests even when a
-- named or program admin also receives them. Add the requested assignments.
begin;

-- Michelle is being assigned the Admin account type. Preserve her current
-- approved employee programs as her admin scope and time-off eligibility.
insert into public.admin_profiles (user_id, status, program_names, is_super_admin)
select u.id, 'approved', wp.approved_program_names, false
from public.users u
join public.worker_profiles wp on wp.user_id = u.id
where lower(u.email) = 'mmanganello@brightharbor.org'
  and u.role = 'employee'
on conflict (user_id) do update
set status = 'approved',
    program_names = excluded.program_names,
    is_super_admin = false,
    requested_program_names = null;

update public.users
set role = 'admin', account_type_changed_at = now()
where lower(email) = 'mmanganello@brightharbor.org' and role = 'employee';

update public.admin_profiles ap
set program_names = array['Marketing/Development', 'Salt Bridge Farms']::text[],
    requested_program_names = null
from public.users u
where ap.user_id = u.id
  and lower(u.email) = 'kchiarello@brightharbor.org'
  and ap.status = 'approved';

-- Complete the requested program assignments so these staff can submit leave.
update public.worker_profiles wp
set program_name = 'The NOOK',
    program_names = array['The NOOK']::text[],
    approved_program_names = array['The NOOK']::text[],
    status = 'approved'
from public.users u
where wp.user_id = u.id and lower(u.email) = 'vpizzimenti@brightharbor.org';

update public.supervisor_profiles sp
set program_names = array['REAL Team']::text[], status = 'approved',
    requested_program_names = null
from public.users u
where sp.user_id = u.id and lower(u.email) = 'skingston@brightharbor.org';

update public.supervisor_profiles sp
set program_names = array[
      'Beacon/ Anchor',
      'Building Empowerment to Achieve Community Housing (BEACH)'
    ]::text[],
    status = 'approved', requested_program_names = null
from public.users u
where sp.user_id = u.id and lower(u.email) = 'mgriffith@brightharbor.org';

update public.supervisor_profiles sp
set program_names = array['Chelsea']::text[], requested_program_names = null
from public.users u
where sp.user_id = u.id and lower(u.email) = 'nprisco@brightharbor.org';

update public.supervisor_profiles sp
set program_names = array['Community Resources for Emergency Support and Treatment (CREST)']::text[],
    status = 'approved', requested_program_names = null
from public.users u
where sp.user_id = u.id and lower(u.email) = 'kmott@brightharbor.org';

do $$
declare
  staff_count integer;
  reviewer_count integer;
begin
  select count(*) into staff_count from public.users
  where lower(email) in (
    'npeirano@brightharbor.org', 'jmadrigal@brightharbor.org',
    'jkenney@brightharbor.org', 'vpizzimenti@brightharbor.org',
    'skingston@brightharbor.org', 'nprisco@brightharbor.org',
    'jpampalone@brightharbor.org', 'mgriffith@brightharbor.org',
    'juliaiachetta@brightharbor.org', 'kmott@brightharbor.org',
    'asmith@brightharbor.org'
  );
  select count(*) into reviewer_count
  from public.users u
  join public.admin_profiles ap on ap.user_id = u.id and ap.status = 'approved'
  where u.role = 'admin' and lower(u.email) in (
    'rjohnson@brightharbor.org', 'kchiarello@brightharbor.org',
    'mmanganello@brightharbor.org', 'gdelpizzo@brightharbor.org',
    'lreinwald@brightharbor.org'
  );
  if staff_count <> 11 or reviewer_count <> 5 then
    raise exception 'Expected 11 staff and 5 approved admin reviewers; found % staff and % reviewers',
      staff_count, reviewer_count;
  end if;
end;
$$;

-- Arielle is moving from Meghan/Michele to Gina/Leigh.
delete from public.time_off_review_assignments assignment
using public.users requester, public.users reviewer
where assignment.requester_id = requester.id
  and assignment.reviewer_id = reviewer.id
  and lower(requester.email) = 'asmith@brightharbor.org'
  and lower(reviewer.email) in ('mcorrigan@brightharbor.org', 'mharper@brightharbor.org');

with assignments(reviewer_email, requester_email) as (values
  ('rjohnson@brightharbor.org', 'npeirano@brightharbor.org'),
  ('rjohnson@brightharbor.org', 'jmadrigal@brightharbor.org'),
  ('rjohnson@brightharbor.org', 'jkenney@brightharbor.org'),
  ('rjohnson@brightharbor.org', 'vpizzimenti@brightharbor.org'),
  ('kchiarello@brightharbor.org', 'skingston@brightharbor.org'),
  ('mmanganello@brightharbor.org', 'nprisco@brightharbor.org'),
  ('mmanganello@brightharbor.org', 'jpampalone@brightharbor.org'),
  ('mmanganello@brightharbor.org', 'mgriffith@brightharbor.org'),
  ('mmanganello@brightharbor.org', 'juliaiachetta@brightharbor.org'),
  ('gdelpizzo@brightharbor.org', 'kmott@brightharbor.org'),
  ('lreinwald@brightharbor.org', 'kmott@brightharbor.org'),
  ('gdelpizzo@brightharbor.org', 'asmith@brightharbor.org'),
  ('lreinwald@brightharbor.org', 'asmith@brightharbor.org')
)
insert into public.time_off_review_assignments (requester_id, reviewer_id)
select requester.id, reviewer.id
from assignments a
join public.users requester on lower(requester.email) = a.requester_email
join public.users reviewer on lower(reviewer.email) = a.reviewer_email
on conflict do nothing;

with assignments(program_name, reviewer_email) as (values
  ('Marketing/Development', 'kchiarello@brightharbor.org'),
  ('Salt Bridge Farms', 'kchiarello@brightharbor.org'),
  ('PACT I', 'gdelpizzo@brightharbor.org'),
  ('PACT I', 'lreinwald@brightharbor.org'),
  ('PACT II', 'gdelpizzo@brightharbor.org'),
  ('PACT II', 'lreinwald@brightharbor.org')
)
insert into public.time_off_program_review_assignments (program_name, reviewer_id)
select a.program_name, reviewer.id
from assignments a
join public.users reviewer on lower(reviewer.email) = a.reviewer_email
on conflict do nothing;

create or replace function public.request_review_recipients(
  target_kind text,
  target_program text,
  target_requester_id uuid
)
returns table(user_id uuid, email text, full_name text, role text)
language sql stable security definer set search_path = public as $$
  with employee_supervisor_recipients as (
    select distinct u.id as user_id, u.email, u.full_name, u.role::text as role
    from public.users requester
    join public.supervisor_profiles sp on sp.status = 'approved'
      and public.reviewer_scope_includes_program(target_program, sp.program_names)
    join public.users u on u.id = sp.user_id
    where target_kind = 'time-off'
      and requester.id = target_requester_id
      and requester.role = 'employee'
      and u.id is distinct from target_requester_id
      and u.role in ('supervisor', 'admin')
      and (u.role = 'supervisor' or exists (
        select 1 from public.admin_profiles ap
        where ap.user_id = u.id and ap.status = 'approved'
      ))
      and u.email ~* '^[^@[:space:]]+@brightharbor[.]org$'
  ), staff_override_recipients as (
    select u.id as user_id, u.email, u.full_name, u.role::text as role
    from public.time_off_review_assignments assignment
    join public.users u on u.id = assignment.reviewer_id
    join public.admin_profiles ap on ap.user_id = u.id and ap.status = 'approved'
    where target_kind = 'time-off'
      and assignment.requester_id = target_requester_id
      and u.id is distinct from target_requester_id
      and u.role = 'admin'
      and u.email ~* '^[^@[:space:]]+@brightharbor[.]org$'
  ), program_override_recipients as (
    select u.id as user_id, u.email, u.full_name, u.role::text as role
    from public.time_off_program_review_assignments assignment
    join public.users u on u.id = assignment.reviewer_id
    join public.admin_profiles ap on ap.user_id = u.id and ap.status = 'approved'
    where target_kind = 'time-off'
      and assignment.program_name = target_program
      and u.id is distinct from target_requester_id
      and u.role = 'admin'
      and u.email ~* '^[^@[:space:]]+@brightharbor[.]org$'
      and not exists (select 1 from staff_override_recipients)
  ), override_recipients as (
    select * from staff_override_recipients
    union all
    select * from program_override_recipients
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
  select supervisor.user_id, supervisor.email, supervisor.full_name, supervisor.role
  from employee_supervisor_recipients supervisor
  union
  select assigned.user_id, assigned.email, assigned.full_name, assigned.role
  from override_recipients assigned
  union
  select ranked.id, ranked.email, ranked.full_name, ranked.app_role
  from ranked
  where ranked.priority < 99
    and ranked.priority = (select min(other.priority) from ranked other)
    and not exists (select 1 from override_recipients)
    and not exists (select 1 from employee_supervisor_recipients)
  order by full_name, user_id
$$;

revoke all on function public.request_review_recipients(text, text, uuid) from public, anon, authenticated;
grant execute on function public.request_review_recipients(text, text, uuid) to service_role;

-- Re-route any pending in-app notifications; existing requests remain intact.
insert into public.notifications (user_id, role, title, body, request_kind, request_id)
select recipient.user_id, recipient.role,
  'Time off approval needed',
  t.employee_name || ' submitted a time off request for ' || t.program_name || '.',
  'time-off', t.id
from public.time_off_requests t
cross join lateral public.request_review_recipients('time-off', t.program_name, t.user_id) recipient
where t.status = 'pending_supervisor_approval'
on conflict do nothing;

commit;
