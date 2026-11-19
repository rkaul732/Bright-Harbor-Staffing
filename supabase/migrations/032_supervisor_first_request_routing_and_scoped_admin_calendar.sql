-- Employee requests go to assigned supervisors. An assigned admin is used only
-- where no approved supervisor exists. Admins review supervisor requests;
-- Super Admins continue reviewing admin requests.
begin;

create or replace function public.request_review_recipients(
  target_kind text,
  target_program text,
  target_requester_id uuid
)
returns table(user_id uuid, email text, full_name text, role text)
language sql stable security definer set search_path = public as $$
  with requester as (
    select u.role::text as role from public.users u where u.id = target_requester_id
  ), assigned_supervisor as (
    select 1
    from public.supervisor_profiles sp
    join public.users supervisor on supervisor.id = sp.user_id
    where sp.status = 'approved'
      and supervisor.role = 'supervisor'
      and public.reviewer_scope_includes_program(target_program, sp.program_names)
    limit 1
  ), base_recipients as (
    select recipient.user_id, recipient.email, recipient.full_name, recipient.role
    from public.request_review_recipients_core(
      case when target_kind = 'shift' and (select requester.role from requester) <> 'employee'
        then 'time-off' else target_kind end,
      target_program, target_requester_id
    ) recipient
    where not (
      (select requester.role from requester) = 'employee'
      and exists (select 1 from assigned_supervisor)
      and recipient.role = 'admin'
    )
  ), michele_peer as (
    select michele.id as user_id, michele.email, michele.full_name,
      michele.role::text as role
    from base_recipients meghan_recipient
    join public.users meghan on meghan.id = meghan_recipient.user_id
    join public.users michele on lower(michele.email) = 'mharper@brightharbor.org'
    join public.admin_profiles michele_admin
      on michele_admin.user_id = michele.id and michele_admin.status = 'approved'
    where target_kind = 'time-off'
      and lower(meghan.email) = 'mcorrigan@brightharbor.org'
      and michele.id is distinct from target_requester_id
      and michele.role = 'admin'
  )
  select base.user_id, base.email, base.full_name, base.role from base_recipients base
  union
  select peer.user_id, peer.email, peer.full_name, peer.role from michele_peer peer
  order by full_name, user_id
$$;

revoke all on function public.request_review_recipients(text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.request_review_recipients(text, text, uuid)
  to service_role;

-- An Ocean Academy employee's conflict or blackout request follows the same
-- supervisor routing. Supervisors' own requests still escalate to an admin.
create or replace function public.ocean_academy_special_reviewers(target_requester_id uuid)
returns table(user_id uuid, email text, full_name text, role text)
language sql stable security definer set search_path = public as $$
  select r.user_id, r.email, r.full_name, r.role
  from public.request_review_recipients('time-off', 'Ocean Academy', target_requester_id) r
$$;

revoke all on function public.ocean_academy_special_reviewers(uuid)
  from public, anon, authenticated;
grant execute on function public.ocean_academy_special_reviewers(uuid) to service_role;

create or replace function public.ocean_academy_special_notification_recipients(target_requester_id uuid)
returns table(user_id uuid, email text, full_name text, role text)
language sql stable security definer set search_path = public as $$
  select r.user_id, r.email, r.full_name, r.role
  from public.ocean_academy_special_reviewers(target_requester_id) r
$$;

revoke all on function public.ocean_academy_special_notification_recipients(uuid)
  from public, anon, authenticated;
grant execute on function public.ocean_academy_special_notification_recipients(uuid)
  to service_role;

create or replace function public.notify_program_reviewers(
  target_request_id uuid,
  target_kind text,
  target_program text,
  requester_name text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  requester_id uuid;
  needs_special_approval boolean := false;
begin
  if target_kind = 'time-off' then
    select t.user_id, t.special_approval_requested
      into requester_id, needs_special_approval
    from public.time_off_requests t where t.id = target_request_id;
  else
    select r.requestor_id into requester_id from public.requests r where r.id = target_request_id;
  end if;

  insert into public.notifications (user_id, role, title, body, request_kind, request_id)
  select recipient.user_id, recipient.role,
    case when needs_special_approval then 'Ocean Academy special approval needed'
      when target_kind = 'time-off' then 'Time off approval needed'
      else 'Shift approval needed' end,
    requester_name || ' submitted a ' ||
      case when target_kind = 'time-off' then 'time off' else 'shift coverage' end ||
      ' request for ' || target_program ||
      case when needs_special_approval then ' that needs special approval.' else '.' end,
    target_kind, target_request_id
  from (
    select r.user_id, r.role
    from public.request_review_recipients(target_kind, target_program, requester_id) r
    where not needs_special_approval
    union
    select r.user_id, r.role
    from public.ocean_academy_special_notification_recipients(requester_id) r
    where needs_special_approval
  ) recipient
  on conflict do nothing;
end;
$$;

create or replace function public.current_reviewer_can_decide_ocean_special(requester_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_reviewer_can_decide_time_off(requester_id, 'Ocean Academy')
$$;

revoke all on function public.current_reviewer_can_decide_ocean_special(uuid)
  from public, anon;
grant execute on function public.current_reviewer_can_decide_ocean_special(uuid)
  to authenticated;

create or replace function public.enforce_ocean_academy_special_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  approved_overlap boolean;
  blackout_overlap boolean;
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
      or new.program_name is distinct from old.program_name
      or new.start_date is distinct from old.start_date
      or new.end_date is distinct from old.end_date
      or new.special_approval_requested is distinct from old.special_approval_requested
      or new.date_conflict is distinct from old.date_conflict
      or new.blackout_conflict is distinct from old.blackout_conflict then
      raise exception 'Submitted time off dates and conflict flags cannot be changed';
    end if;
    if old.special_approval_requested
      and new.status is distinct from old.status
      and new.status in ('approved', 'declined')
      and auth.uid() is not null
      and not public.current_reviewer_can_decide_ocean_special(old.user_id) then
      raise exception 'Ocean Academy special approval requires the assigned reviewer';
    end if;
    return new;
  end if;

  if new.program_name <> 'Ocean Academy' or new.status <> 'pending_supervisor_approval' then
    new.special_approval_requested := false;
    new.date_conflict := false;
    new.blackout_conflict := false;
    return new;
  end if;

  select exists (
    select 1 from public.time_off_requests t
    where t.program_name = 'Ocean Academy'
      and t.status = 'approved'
      and t.user_id <> new.user_id
      and t.start_date <= new.end_date
      and t.end_date >= new.start_date
  ) into approved_overlap;
  select exists (
    select 1 from public.ocean_academy_blackouts b
    where b.start_date <= new.end_date
      and b.end_date >= new.start_date
  ) into blackout_overlap;

  if (approved_overlap or blackout_overlap) and not new.special_approval_requested then
    raise exception 'Special supervisor approval acknowledgement is required for Ocean Academy date conflicts';
  end if;

  new.date_conflict := approved_overlap;
  new.blackout_conflict := blackout_overlap;
  new.special_approval_requested := approved_overlap or blackout_overlap;
  return new;
end;
$$;

revoke all on function public.enforce_ocean_academy_special_approval()
  from public, anon, authenticated;

create or replace function public.current_reviewer_can_decide_shift(
  requester_id uuid,
  target_program text
)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_app_role() in ('supervisor', 'admin')
    and exists (
      select 1 from public.request_review_recipients('shift', target_program, requester_id) recipient
      where recipient.user_id = auth.uid()
    )
$$;

revoke all on function public.current_reviewer_can_decide_shift(uuid, text)
  from public, anon;
grant execute on function public.current_reviewer_can_decide_shift(uuid, text)
  to authenticated;

drop policy if exists "time off readable by assigned team" on public.time_off_requests;
create policy "time off readable by assigned team"
on public.time_off_requests for select to authenticated
using (
  user_id = (select auth.uid())
  or (
    public.current_supervisor_can_access_program(program_name)
    and (select u.role::text from public.users u where u.id = user_id) = 'employee'
  )
  or (
    public.current_admin_can_access_program(program_name)
    and (
      (select u.role::text from public.users u where u.id = user_id) = 'supervisor'
      or (
        (select u.role::text from public.users u where u.id = user_id) = 'employee'
        and (status = 'approved' or public.current_reviewer_can_decide_time_off(user_id, program_name))
      )
      or (
        (select u.role::text from public.users u where u.id = user_id) = 'admin'
        and public.current_admin_is_super_admin()
      )
    )
  )
);

drop policy if exists "requests readable by scoped team" on public.requests;
create policy "requests readable by scoped team"
on public.requests for select to authenticated
using (
  requestor_id = (select auth.uid())
  or exists (
    select 1 from public.shift_posts sp
    where sp.id = requests.shift_id
      and (
        (
          public.current_supervisor_can_access_program(sp.program_name)
          and (select u.role::text from public.users u where u.id = requestor_id) = 'employee'
        )
        or (
          public.current_admin_can_access_program(sp.program_name)
          and (
            (select u.role::text from public.users u where u.id = requestor_id) = 'supervisor'
            or (
              (select u.role::text from public.users u where u.id = requestor_id) = 'employee'
              and public.current_reviewer_can_decide_shift(requestor_id, sp.program_name)
            )
            or (
              (select u.role::text from public.users u where u.id = requestor_id) = 'admin'
              and public.current_admin_is_super_admin()
            )
          )
        )
      )
  )
);

drop policy if exists "supervisors scoped admins review requests" on public.requests;
create policy "supervisors scoped admins review requests"
on public.requests for update to authenticated
using (exists (
  select 1 from public.shift_posts sp
  where sp.id = requests.shift_id
    and public.current_reviewer_can_decide_shift(requestor_id, sp.program_name)
))
with check (exists (
  select 1 from public.shift_posts sp
  where sp.id = requests.shift_id
    and public.current_reviewer_can_decide_shift(requestor_id, sp.program_name)
));

-- A role-wide notification may be read by that role; a targeted notification
-- belongs only to its recipient.
drop policy if exists "notifications read relevant" on public.notifications;
create policy "notifications read relevant"
on public.notifications for select to authenticated
using (
  user_id = (select auth.uid())
  or (user_id is null and (role = 'all' or role = public.current_app_role()::text))
);

-- Clear stale admin notices for employee requests now owned by a supervisor.
delete from public.notifications n
using public.time_off_requests t, public.users requester, public.users recipient
where n.request_kind = 'time-off' and n.request_id = t.id
  and requester.id = t.user_id and requester.role = 'employee'
  and recipient.id = n.user_id and recipient.role = 'admin'
  and exists (
    select 1 from public.supervisor_profiles sp
    join public.users supervisor on supervisor.id = sp.user_id
    where sp.status = 'approved' and supervisor.role = 'supervisor'
      and public.reviewer_scope_includes_program(t.program_name, sp.program_names)
  );

delete from public.notifications n
using public.requests r, public.shift_posts shift, public.users requester, public.users recipient
where n.request_kind = 'shift' and n.request_id = r.id
  and shift.id = r.shift_id
  and requester.id = r.requestor_id and requester.role = 'employee'
  and recipient.id = n.user_id and recipient.role = 'admin'
  and exists (
    select 1 from public.supervisor_profiles sp
    join public.users supervisor on supervisor.id = sp.user_id
    where sp.status = 'approved' and supervisor.role = 'supervisor'
      and public.reviewer_scope_includes_program(shift.program_name, sp.program_names)
  );

-- Make current pending requests visible to their assigned supervisors.
insert into public.notifications (user_id, role, title, body, request_kind, request_id)
select recipient.user_id, recipient.role, 'Time off approval needed',
  t.employee_name || ' submitted a time off request for ' || t.program_name || '.',
  'time-off', t.id
from public.time_off_requests t
cross join lateral public.request_review_recipients('time-off', t.program_name, t.user_id) recipient
where t.status = 'pending_supervisor_approval' and recipient.role = 'supervisor'
on conflict do nothing;

do $$
declare
  ocean_employee uuid := (select id from public.users where lower(email) = 'aferenc@brightharbor.org');
  ocean_supervisor uuid := (select id from public.users where lower(email) = 'htobia@brightharbor.org');
  hr_employee uuid := (select id from public.users where lower(email) = 'internships@brightharbor.org');
begin
  if ocean_employee is null or ocean_supervisor is null or hr_employee is null then
    raise exception 'Reviewer routing verification accounts are missing';
  end if;
  if (
    select array_agg(lower(r.email) order by lower(r.email))
    from public.request_review_recipients('time-off', 'Ocean Academy', ocean_employee) r
  ) is distinct from array['htobia@brightharbor.org', 'mdaniele@brightharbor.org']::text[] then
    raise exception 'Ocean Academy employee time off must reach only its supervisors';
  end if;
  if (
    select array_agg(lower(r.email) order by lower(r.email))
    from public.request_review_recipients('shift', 'Ocean Academy', ocean_employee) r
  ) is distinct from array['htobia@brightharbor.org', 'mdaniele@brightharbor.org']::text[] then
    raise exception 'Ocean Academy employee shift requests must reach only its supervisors';
  end if;
  if (
    select array_agg(lower(r.email) order by lower(r.email))
    from public.ocean_academy_special_notification_recipients(ocean_employee) r
  ) is distinct from array['htobia@brightharbor.org', 'mdaniele@brightharbor.org']::text[] then
    raise exception 'Ocean Academy special requests must reach only its supervisors';
  end if;
  if not exists (
    select 1 from public.request_review_recipients('time-off', 'Ocean Academy', ocean_supervisor) r
    where lower(r.email) = 'tnormile@brightharbor.org'
  ) then
    raise exception 'Ocean Academy supervisor time off must reach Thomas Normile';
  end if;
  if not exists (
    select 1 from public.request_review_recipients('time-off', 'HR', hr_employee) r
    where r.role = 'admin'
  ) then
    raise exception 'An unassigned program must retain an admin fallback';
  end if;
end;
$$;

commit;
