-- Route request alerts to approved reviewers assigned to the request's program.
alter table public.notifications
  add column if not exists request_kind text,
  add column if not exists request_id uuid;

create unique index if not exists notifications_request_recipient_idx
  on public.notifications (user_id, request_kind, request_id)
  where user_id is not null and request_id is not null;

alter table public.requests
  alter column supervisor_email drop not null,
  alter column supervisor_email drop default;

alter table public.shift_posts
  alter column supervisor_email drop not null,
  alter column supervisor_email drop default;

create or replace function public.assigned_program_supervisor_email(target_program text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email
  from public.supervisor_profiles sp
  join public.users u on u.id = sp.user_id
  where sp.status = 'approved'
    and u.role = 'supervisor'
    and target_program = any(sp.program_names)
  order by u.full_name, u.id
  limit 1
$$;

revoke all on function public.assigned_program_supervisor_email(text) from public, anon, authenticated;

create or replace function public.set_shift_program_supervisor_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.supervisor_email := public.assigned_program_supervisor_email(new.program_name);
  return new;
end;
$$;

drop trigger if exists shift_program_supervisor_email on public.shift_posts;
create trigger shift_program_supervisor_email
before insert or update of program_name on public.shift_posts
for each row execute function public.set_shift_program_supervisor_email();

create or replace function public.set_request_program_supervisor_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.supervisor_email := (
    select public.assigned_program_supervisor_email(sp.program_name)
    from public.shift_posts sp
    where sp.id = new.shift_id
  );
  return new;
end;
$$;

drop trigger if exists request_program_supervisor_email on public.requests;
create trigger request_program_supervisor_email
before insert or update of shift_id on public.requests
for each row execute function public.set_request_program_supervisor_email();

create or replace function public.notify_program_reviewers(
  target_request_id uuid,
  target_kind text,
  target_program text,
  requester_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, role, title, body, request_kind, request_id)
  select u.id, u.role::text,
    case when target_kind = 'time-off' then 'Time off approval needed' else 'Shift approval needed' end,
    requester_name || ' submitted a ' ||
      case when target_kind = 'time-off' then 'time off' else 'shift coverage' end ||
      ' request for ' || target_program || '.',
    target_kind,
    target_request_id
  from public.users u
  where (
    u.role = 'supervisor'
    and exists (
      select 1 from public.supervisor_profiles sp
      where sp.user_id = u.id
        and sp.status = 'approved'
        and target_program = any(sp.program_names)
    )
  ) or (
    u.role = 'admin'
    and exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = u.id
        and ap.status = 'approved'
        and target_program = any(ap.program_names)
    )
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.notify_program_reviewers(uuid, text, text, text) from public, anon, authenticated;

-- Preserve Meghan's existing scope and ensure her approved admin account includes ISC.
update public.admin_profiles ap
set program_names = array_append(ap.program_names, 'Integrated System of Care (ISC)')
from public.users u
where u.id = ap.user_id
  and u.role = 'admin'
  and lower(trim(u.full_name)) = 'meghan corrigan'
  and ap.status = 'approved'
  and not ('Integrated System of Care (ISC)' = any(ap.program_names));

create or replace function public.route_shift_request_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_program text;
begin
  if new.status = 'pending_supervisor_approval' then
    select sp.program_name into requested_program
    from public.shift_posts sp where sp.id = new.shift_id;
    perform public.notify_program_reviewers(new.id, 'shift', requested_program, new.requestor_name);
  end if;
  return new;
end;
$$;

create or replace function public.route_time_off_request_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending_supervisor_approval' then
    perform public.notify_program_reviewers(new.id, 'time-off', new.program_name, new.employee_name);
  end if;
  return new;
end;
$$;

drop trigger if exists time_off_request_routing_notification on public.time_off_requests;
create trigger time_off_request_routing_notification
after insert on public.time_off_requests
for each row execute function public.route_time_off_request_notification();

-- When a supervisor or admin is later assigned, route still-pending requests.
create or replace function public.notify_newly_assigned_reviewer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pending_request record;
begin
  if new.status <> 'approved' then
    return new;
  end if;

  for pending_request in
    select t.id, t.program_name, t.employee_name
    from public.time_off_requests t
    where t.status = 'pending_supervisor_approval'
      and t.program_name = any(new.program_names)
  loop
    perform public.notify_program_reviewers(
      pending_request.id, 'time-off', pending_request.program_name, pending_request.employee_name
    );
  end loop;

  for pending_request in
    select r.id, sp.program_name, r.requestor_name
    from public.requests r
    join public.shift_posts sp on sp.id = r.shift_id
    where r.status = 'pending_supervisor_approval'
      and sp.program_name = any(new.program_names)
  loop
    perform public.notify_program_reviewers(
      pending_request.id, 'shift', pending_request.program_name, pending_request.requestor_name
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists supervisor_new_program_requests on public.supervisor_profiles;
create trigger supervisor_new_program_requests
after insert or update of status, program_names on public.supervisor_profiles
for each row execute function public.notify_newly_assigned_reviewer();

drop trigger if exists admin_new_program_requests on public.admin_profiles;
create trigger admin_new_program_requests
after insert or update of status, program_names on public.admin_profiles
for each row execute function public.notify_newly_assigned_reviewer();

-- Existing pending requests, including the ISC test request, get routed once.
select public.notify_program_reviewers(t.id, 'time-off', t.program_name, t.employee_name)
from public.time_off_requests t
where t.status = 'pending_supervisor_approval';

select public.notify_program_reviewers(r.id, 'shift', sp.program_name, r.requestor_name)
from public.requests r
join public.shift_posts sp on sp.id = r.shift_id
where r.status = 'pending_supervisor_approval';

update public.requests r
set supervisor_email = public.assigned_program_supervisor_email(sp.program_name)
from public.shift_posts sp
where sp.id = r.shift_id
  and r.status = 'pending_supervisor_approval';

update public.shift_posts sp
set supervisor_email = public.assigned_program_supervisor_email(sp.program_name)
where sp.status in ('open', 'draft');

create or replace function public.current_supervisor_can_access_program(target_program text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'supervisor'
    and exists (
      select 1 from public.supervisor_profiles sp
      where sp.user_id = auth.uid()
        and sp.status = 'approved'
        and target_program = any(sp.program_names)
    )
$$;

drop policy if exists "requests readable by scoped team" on public.requests;
create policy "requests readable by scoped team"
on public.requests for select to authenticated
using (
  requestor_id = auth.uid()
  or exists (
    select 1 from public.shift_posts sp
    where sp.id = requests.shift_id
      and (
        public.current_supervisor_can_access_program(sp.program_name)
        or public.current_admin_can_access_program(sp.program_name)
      )
  )
);

drop policy if exists "supervisors scoped admins review requests" on public.requests;
create policy "supervisors scoped admins review requests"
on public.requests for update to authenticated
using (exists (
  select 1 from public.shift_posts sp
  where sp.id = requests.shift_id
    and (
      public.current_supervisor_can_access_program(sp.program_name)
      or public.current_admin_can_access_program(sp.program_name)
    )
))
with check (exists (
  select 1 from public.shift_posts sp
  where sp.id = requests.shift_id
    and (
      public.current_supervisor_can_access_program(sp.program_name)
      or public.current_admin_can_access_program(sp.program_name)
    )
));

drop policy if exists "time off readable by owner or approved reviewers" on public.time_off_requests;
drop policy if exists "time off readable by scoped team" on public.time_off_requests;
create policy "time off readable by assigned team"
on public.time_off_requests for select to authenticated
using (
  user_id = auth.uid()
  or public.current_supervisor_can_access_program(time_off_requests.program_name)
  or public.current_admin_can_access_program(time_off_requests.program_name)
);

drop policy if exists "supervisors scoped admins review time off requests" on public.time_off_requests;
create policy "assigned reviewers update time off requests"
on public.time_off_requests for update to authenticated
using (
  public.current_supervisor_can_access_program(time_off_requests.program_name)
  or public.current_admin_can_access_program(time_off_requests.program_name)
)
with check (
  public.current_supervisor_can_access_program(time_off_requests.program_name)
  or public.current_admin_can_access_program(time_off_requests.program_name)
);

drop policy if exists "notifications read relevant" on public.notifications;
create policy "notifications read relevant"
on public.notifications for select to authenticated
using (
  user_id = auth.uid()
  or (
    user_id is null
    and title not in ('Shift approval needed', 'Code Red/Code Blue approval needed')
    and (role = 'all' or role = public.current_app_role()::text)
  )
);
