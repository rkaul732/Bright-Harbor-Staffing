-- Keep the email recipient, dashboard decision, and database update rules aligned.
-- A LEAP assignment includes its three child programs, as it does in the picker.
begin;

create or replace function public.reviewer_scope_includes_program(
  target_program text,
  assigned_programs text[]
)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(target_program = any(assigned_programs), false)
    or (
      target_program in ('Arrive Together', 'Barricaded Subjects', 'On POINT')
      and coalesce('LEAP (Arrive Together, On POINT, Barricaded Subjects)' = any(assigned_programs), false)
    )
$$;

create or replace function public.current_admin_can_access_program(program_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_app_role() = 'admin'
    and (
      public.current_admin_is_super_admin()
      or public.reviewer_scope_includes_program(program_name, public.current_admin_program_names())
    )
$$;

create or replace function public.current_supervisor_can_access_program(target_program text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_app_role() = 'supervisor'
    and exists (
      select 1 from public.supervisor_profiles sp
      where sp.user_id = auth.uid() and sp.status = 'approved'
        and public.reviewer_scope_includes_program(target_program, sp.program_names)
    )
$$;

create or replace function public.request_review_recipients(
  target_kind text,
  target_program text,
  target_requester_id uuid
)
returns table(user_id uuid, email text, full_name text, role text)
language sql stable security definer set search_path = public as $$
  with requester as (
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
  select ranked.id, ranked.email, ranked.full_name, ranked.app_role
  from ranked
  where ranked.priority < 99
    and ranked.priority = (select min(other.priority) from ranked other)
  order by ranked.full_name, ranked.id
$$;

revoke all on function public.request_review_recipients(text, text, uuid) from public, anon, authenticated;
grant execute on function public.request_review_recipients(text, text, uuid) to service_role;

create or replace function public.current_reviewer_can_decide_time_off(
  requester_id uuid,
  target_program text
)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_app_role() in ('supervisor', 'admin')
    and exists (
      select 1 from public.request_review_recipients('time-off', target_program, requester_id) recipient
      where recipient.user_id = auth.uid()
    )
$$;

revoke all on function public.current_reviewer_can_decide_time_off(uuid, text) from public, anon;
grant execute on function public.current_reviewer_can_decide_time_off(uuid, text) to authenticated;

create or replace function public.current_reviewable_time_off_request_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(t.id order by t.created_at desc), '{}'::uuid[])
  from public.time_off_requests t
  where t.status = 'pending_supervisor_approval'
    and public.current_reviewer_can_decide_time_off(t.user_id, t.program_name)
$$;

revoke all on function public.current_reviewable_time_off_request_ids() from public, anon;
grant execute on function public.current_reviewable_time_off_request_ids() to authenticated;

drop policy if exists "time off readable by assigned team" on public.time_off_requests;
drop policy if exists "time off readable by owner or approved reviewers" on public.time_off_requests;
drop policy if exists "time off readable by scoped team" on public.time_off_requests;
drop policy if exists "time off readable by involved team" on public.time_off_requests;
create policy "time off readable by assigned team" on public.time_off_requests for select to authenticated
using (
  user_id = auth.uid()
  or public.current_admin_is_approved()
  or (
    public.current_supervisor_can_access_program(time_off_requests.program_name)
    and coalesce((select u.role::text from public.users u where u.id = time_off_requests.user_id), 'employee') = 'employee'
  )
);

drop policy if exists "assigned reviewers update time off requests" on public.time_off_requests;
drop policy if exists "supervisors scoped admins review time off requests" on public.time_off_requests;
drop policy if exists "supervisors admins review time off requests" on public.time_off_requests;
create policy "assigned reviewers update time off requests" on public.time_off_requests for update to authenticated
using (public.current_reviewer_can_decide_time_off(user_id, program_name))
with check (public.current_reviewer_can_decide_time_off(user_id, program_name));

commit;
