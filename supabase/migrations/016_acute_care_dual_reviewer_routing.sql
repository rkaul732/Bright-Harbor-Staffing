-- Keep Adult Clinical and Acute Care reviewer assignments separate, and allow
-- an approved admin who also has an approved supervisor profile to coordinate
-- requests as the assigned supervisor. One review still completes a request.

update public.admin_profiles ap
set program_names = array_remove(ap.program_names, 'Involuntary Outpatient Commitment')
from public.users u
where u.id = ap.user_id
  and lower(u.email) = 'mcorrigan@brightharbor.org'
  and 'Involuntary Outpatient Commitment' = any(ap.program_names);

update public.supervisor_profiles sp
set program_names = array_remove(sp.program_names, 'Involuntary Outpatient Commitment')
from public.users u
where u.id = sp.user_id
  and lower(u.email) = 'mcorrigan@brightharbor.org'
  and 'Involuntary Outpatient Commitment' = any(sp.program_names);

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
    and (
      u.role = 'supervisor'
      or (
        u.role = 'admin'
        and exists (
          select 1 from public.admin_profiles ap
          where ap.user_id = u.id and ap.status = 'approved'
        )
      )
    )
    and u.deleted_at is null
    and target_program = any(sp.program_names)
  order by u.full_name, u.id
  limit 1
$$;

revoke all on function public.assigned_program_supervisor_email(text) from public, anon, authenticated;

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
  where u.deleted_at is null
    and (
      (
        (
          u.role = 'supervisor'
          or (
            u.role = 'admin'
            and exists (
              select 1 from public.admin_profiles ap
              where ap.user_id = u.id and ap.status = 'approved'
            )
          )
        )
        and exists (
          select 1 from public.supervisor_profiles sp
          where sp.user_id = u.id
            and sp.status = 'approved'
            and target_program = any(sp.program_names)
        )
      )
      or (
        u.role = 'admin'
        and exists (
          select 1 from public.admin_profiles ap
          where ap.user_id = u.id
            and ap.status = 'approved'
            and target_program = any(ap.program_names)
        )
      )
    )
  on conflict do nothing;
end;
$$;

revoke all on function public.notify_program_reviewers(uuid, text, text, text) from public, anon, authenticated;

-- Update pending requests when either profile becomes approved. Notifications
-- have a unique request/recipient key, so a dual reviewer receives one alert.
create or replace function public.refresh_program_supervisor_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' then
    update public.time_off_requests t
    set supervisor_email = public.assigned_program_supervisor_email(t.program_name)
    where t.status = 'pending_supervisor_approval'
      and t.program_name = any(new.program_names);

    update public.requests r
    set supervisor_email = public.assigned_program_supervisor_email(sp.program_name)
    from public.shift_posts sp
    where sp.id = r.shift_id
      and r.status = 'pending_supervisor_approval'
      and sp.program_name = any(new.program_names);

    perform public.notify_program_reviewers(t.id, 'time-off', t.program_name, t.employee_name)
    from public.time_off_requests t
    where t.status = 'pending_supervisor_approval'
      and t.program_name = any(new.program_names);

    perform public.notify_program_reviewers(r.id, 'shift', sp.program_name, r.requestor_name)
    from public.requests r
    join public.shift_posts sp on sp.id = r.shift_id
    where r.status = 'pending_supervisor_approval'
      and sp.program_name = any(new.program_names);
  end if;

  return new;
end;
$$;

drop trigger if exists refresh_program_supervisor_assignments on public.supervisor_profiles;
create trigger refresh_program_supervisor_assignments
after insert or update of status, program_names on public.supervisor_profiles
for each row execute function public.refresh_program_supervisor_assignments();

drop trigger if exists refresh_program_admin_assignments on public.admin_profiles;
create trigger refresh_program_admin_assignments
after insert or update of status, program_names on public.admin_profiles
for each row execute function public.refresh_program_supervisor_assignments();
