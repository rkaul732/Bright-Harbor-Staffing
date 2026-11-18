-- Michele Harper may review every time-off request routed to Meghan Corrigan.
-- Keep their separately assigned programs and shift responsibilities intact.
begin;

create or replace function public.request_review_recipients_core(
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

revoke all on function public.request_review_recipients_core(text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.request_review_recipients_core(text, text, uuid)
  to service_role;

-- This wrapper is the single source for reviewer emails, in-app routing, and
-- decision authorization. Michele inherits Meghan's time-off recipients only.
create or replace function public.request_review_recipients(
  target_kind text,
  target_program text,
  target_requester_id uuid
)
returns table(user_id uuid, email text, full_name text, role text)
language sql stable security definer set search_path = public as $$
  with base_recipients as (
    select recipient.user_id, recipient.email, recipient.full_name, recipient.role
    from public.request_review_recipients_core(
      target_kind, target_program, target_requester_id
    ) recipient
  ), michele_peer as (
    select michele.id as user_id, michele.email, michele.full_name,
      michele.role::text as role
    from base_recipients meghan_recipient
    join public.users meghan on meghan.id = meghan_recipient.user_id
    join public.users michele
      on lower(michele.email) = 'mharper@brightharbor.org'
    join public.admin_profiles michele_admin
      on michele_admin.user_id = michele.id
      and michele_admin.status = 'approved'
    where target_kind = 'time-off'
      and lower(meghan.email) = 'mcorrigan@brightharbor.org'
      and michele.id is distinct from target_requester_id
      and michele.role = 'admin'
  )
  select base.user_id, base.email, base.full_name, base.role
  from base_recipients base
  union
  select peer.user_id, peer.email, peer.full_name, peer.role
  from michele_peer peer
  order by full_name, user_id
$$;

revoke all on function public.request_review_recipients(text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.request_review_recipients(text, text, uuid)
  to service_role;

-- Reviewers can reopen completed requests only for explicit staff/program
-- assignments. Apply Meghan's explicit assignments to Michele here too.
create or replace function public.current_reviewable_time_off_request_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(t.id order by t.created_at desc), '{}'::uuid[])
  from public.time_off_requests t
  where (
      t.status = 'pending_supervisor_approval'
      or (
        t.status in ('approved', 'declined')
        and (
          exists (
            select 1 from public.time_off_review_assignments assignment
            where assignment.requester_id = t.user_id
              and assignment.reviewer_id = auth.uid()
          )
          or exists (
            select 1 from public.time_off_program_review_assignments assignment
            where assignment.program_name = t.program_name
              and assignment.reviewer_id = auth.uid()
          )
          or (
            auth.uid() = (
              select id from public.users
              where lower(email) = 'mharper@brightharbor.org'
            )
            and exists (
              select 1
              from public.users meghan
              where lower(meghan.email) = 'mcorrigan@brightharbor.org'
                and (
                  exists (
                    select 1 from public.time_off_review_assignments assignment
                    where assignment.requester_id = t.user_id
                      and assignment.reviewer_id = meghan.id
                  )
                  or exists (
                    select 1 from public.time_off_program_review_assignments assignment
                    where assignment.program_name = t.program_name
                      and assignment.reviewer_id = meghan.id
                  )
                )
            )
          )
        )
      )
    )
    and public.current_reviewer_can_decide_time_off(t.user_id, t.program_name)
$$;

revoke all on function public.current_reviewable_time_off_request_ids()
  from public, anon;
grant execute on function public.current_reviewable_time_off_request_ids()
  to authenticated;

-- Surface requests already awaiting review without re-sending old emails.
insert into public.notifications (user_id, role, title, body, request_kind, request_id)
select recipient.user_id, recipient.role,
  'Time off approval needed',
  t.employee_name || ' submitted a time off request for ' || t.program_name || '.',
  'time-off', t.id
from public.time_off_requests t
cross join lateral public.request_review_recipients('time-off', t.program_name, t.user_id) recipient
where t.status = 'pending_supervisor_approval'
  and lower(recipient.email) = 'mharper@brightharbor.org'
on conflict do nothing;

do $$
begin
  if not exists (
    select 1 from public.users u
    join public.admin_profiles ap on ap.user_id = u.id and ap.status = 'approved'
    where lower(u.email) = 'mharper@brightharbor.org' and u.role = 'admin'
  ) or not exists (
    select 1 from public.users u
    join public.admin_profiles ap on ap.user_id = u.id and ap.status = 'approved'
    where lower(u.email) = 'mcorrigan@brightharbor.org' and u.role = 'admin'
  ) then
    raise exception 'Meghan and Michele must both have approved admin profiles';
  end if;

  if exists (
    select 1
    from public.time_off_requests t
    where t.user_id <> (
      select id from public.users where lower(email) = 'mharper@brightharbor.org'
    )
      and exists (
        select 1 from public.request_review_recipients('time-off', t.program_name, t.user_id) r
        where lower(r.email) = 'mcorrigan@brightharbor.org'
      )
      and not exists (
        select 1 from public.request_review_recipients('time-off', t.program_name, t.user_id) r
        where lower(r.email) = 'mharper@brightharbor.org'
      )
  ) then
    raise exception 'Michele still lacks access to a request routed to Meghan';
  end if;
end;
$$;

commit;
