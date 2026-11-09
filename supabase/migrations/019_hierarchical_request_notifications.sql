-- Give approved admins a read-only view of every department's requests, while
-- keeping decisions scoped to the assigned reviewer and escalating staff leave.
begin;

alter table public.notifications
  add column if not exists request_kind text,
  add column if not exists request_id uuid;

create unique index if not exists notifications_request_recipient_idx
  on public.notifications (user_id, request_kind, request_id)
  where user_id is not null and request_id is not null;

create or replace function public.current_admin_is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_app_role() = 'admin'
    and exists (
      select 1 from public.admin_profiles ap
      where ap.user_id = auth.uid() and ap.status = 'approved'
    )
$$;

-- Earlier production setups may have the original broad reviewer policies
-- without the scoped helper introduced in migration 011.
create or replace function public.current_supervisor_can_access_program(target_program text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_app_role() = 'supervisor'
    and exists (
      select 1 from public.supervisor_profiles sp
      where sp.user_id = auth.uid() and sp.status = 'approved'
        and target_program = any(sp.program_names)
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
    select case when target_kind = 'shift' then 'employee'
      else coalesce((select u.role::text from public.users u where u.id = target_requester_id), 'employee')
    end as requester_role
  ), candidates as (
    select u.id, u.email, u.full_name, u.role::text as app_role,
      exists (
        select 1 from public.supervisor_profiles sp
        where sp.user_id = u.id and sp.status = 'approved'
          and target_program = any(sp.program_names)
      ) as assigned_supervisor,
      exists (
        select 1 from public.admin_profiles ap
        where ap.user_id = u.id and ap.status = 'approved'
          and target_program = any(ap.program_names)
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

create or replace function public.notify_program_reviewers(
  target_request_id uuid,
  target_kind text,
  target_program text,
  requester_name text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  requester_id uuid;
begin
  if target_kind = 'time-off' then
    select t.user_id into requester_id from public.time_off_requests t where t.id = target_request_id;
  else
    select r.requestor_id into requester_id from public.requests r where r.id = target_request_id;
  end if;

  insert into public.notifications (user_id, role, title, body, request_kind, request_id)
  select recipient.user_id, recipient.role,
    case when target_kind = 'time-off' then 'Time off approval needed' else 'Shift approval needed' end,
    requester_name || ' submitted a ' ||
      case when target_kind = 'time-off' then 'time off' else 'shift coverage' end ||
      ' request for ' || target_program || '.',
    target_kind, target_request_id
  from public.request_review_recipients(target_kind, target_program, requester_id) recipient
  on conflict do nothing;
end;
$$;

create or replace function public.route_time_off_request_notification()
returns trigger language plpgsql security definer set search_path = public as $$
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

create or replace function public.current_reviewer_can_decide_time_off(
  requester_id uuid,
  target_program text
)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_app_role() in ('supervisor', 'admin')
    and auth.uid() is distinct from requester_id
    and case (select u.role::text from public.users u where u.id = requester_id)
      when 'admin' then public.current_admin_is_super_admin()
      when 'supervisor' then public.current_admin_can_access_program(target_program)
      else public.current_supervisor_can_access_program(target_program)
        or public.current_admin_can_access_program(target_program)
    end
$$;

drop policy if exists "shifts readable by program scope" on public.shift_posts;
drop policy if exists "shifts readable" on public.shift_posts;
create policy "shifts readable by program scope" on public.shift_posts for select to authenticated
using (
  public.current_app_role() = 'supervisor'
  or public.current_admin_is_approved()
  or exists (
    select 1 from public.worker_profiles wp
    where wp.user_id = auth.uid() and shift_posts.program_name = any(wp.program_names)
  )
);

drop policy if exists "requests readable by scoped team" on public.requests;
drop policy if exists "requests readable by involved team" on public.requests;
create policy "requests readable by scoped team" on public.requests for select to authenticated
using (
  requestor_id = auth.uid()
  or public.current_admin_is_approved()
  or exists (
    select 1 from public.shift_posts sp
    where sp.id = requests.shift_id
      and public.current_supervisor_can_access_program(sp.program_name)
  )
);

drop policy if exists "supervisors admins review requests" on public.requests;
drop policy if exists "supervisors scoped admins review requests" on public.requests;
create policy "supervisors scoped admins review requests" on public.requests for update to authenticated
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

drop policy if exists "time off readable by assigned team" on public.time_off_requests;
drop policy if exists "time off readable by owner or approved reviewers" on public.time_off_requests;
create policy "time off readable by assigned team" on public.time_off_requests for select to authenticated
using (
  user_id = auth.uid()
  or public.current_admin_is_approved()
  or public.current_supervisor_can_access_program(time_off_requests.program_name)
);

drop policy if exists "employees create own time off requests" on public.time_off_requests;
create policy "staff create own time off requests" on public.time_off_requests for insert to authenticated
with check (
  user_id = auth.uid()
  and (
    (public.current_app_role() = 'employee' and exists (
      select 1 from public.worker_profiles wp
      where wp.user_id = auth.uid() and time_off_requests.program_name = any(wp.program_names)
    ))
    or public.current_supervisor_can_access_program(time_off_requests.program_name)
    or public.current_admin_can_access_program(time_off_requests.program_name)
  )
);

drop policy if exists "assigned reviewers update time off requests" on public.time_off_requests;
drop policy if exists "supervisors admins review time off requests" on public.time_off_requests;
create policy "assigned reviewers update time off requests" on public.time_off_requests for update to authenticated
using (public.current_reviewer_can_decide_time_off(user_id, program_name))
with check (public.current_reviewer_can_decide_time_off(user_id, program_name));

-- Nicole is the named Outpatient (Adult) coordinator. Her invited supervisor
-- profile already contains the correct program but is still pending review.
update public.supervisor_profiles sp
set status = 'approved', approved_at = coalesce(sp.approved_at, now()),
    approved_by = (select u.id from public.users u where lower(u.email) = 'rkaul@brightharbor.org' limit 1)
from public.users u
where sp.user_id = u.id and lower(u.email) = 'nsullivan@brightharbor.org'
  and 'Outpatient Services' = any(sp.program_names) and sp.status = 'pending';

commit;
