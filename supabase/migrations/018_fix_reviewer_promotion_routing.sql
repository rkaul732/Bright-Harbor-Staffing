-- Time off requests are routed by program and have no supervisor_email column.
-- Repair reviewer refresh triggers and route requests after account promotions.
begin;

create or replace function public.refresh_program_supervisor_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' then
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

-- Account-type changes create the approved profile before changing users.role.
-- Refresh routing after the role changes so a newly promoted reviewer receives
-- alerts for already-pending requests as well as future requests.
create or replace function public.refresh_reviewer_role_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  scoped_programs text[];
begin
  if new.role is not distinct from old.role
     or new.role not in ('supervisor', 'admin') then
    return new;
  end if;

  select coalesce(array_agg(distinct program_name), '{}'::text[])
  into scoped_programs
  from (
    select unnest(sp.program_names) as program_name
    from public.supervisor_profiles sp
    where sp.user_id = new.id
      and sp.status = 'approved'
      and (
        new.role = 'supervisor'
        or (
          new.role = 'admin'
          and exists (
            select 1 from public.admin_profiles ap
            where ap.user_id = new.id and ap.status = 'approved'
          )
        )
      )
    union
    select unnest(ap.program_names) as program_name
    from public.admin_profiles ap
    where ap.user_id = new.id
      and ap.status = 'approved'
      and new.role = 'admin'
  ) reviewer_programs;

  if cardinality(scoped_programs) = 0 then
    return new;
  end if;

  update public.shift_posts sp
  set supervisor_email = public.assigned_program_supervisor_email(sp.program_name)
  where sp.status in ('open', 'draft')
    and sp.program_name = any(scoped_programs);

  update public.requests r
  set supervisor_email = public.assigned_program_supervisor_email(sp.program_name)
  from public.shift_posts sp
  where sp.id = r.shift_id
    and r.status = 'pending_supervisor_approval'
    and sp.program_name = any(scoped_programs);

  perform public.notify_program_reviewers(t.id, 'time-off', t.program_name, t.employee_name)
  from public.time_off_requests t
  where t.status = 'pending_supervisor_approval'
    and t.program_name = any(scoped_programs);

  perform public.notify_program_reviewers(r.id, 'shift', sp.program_name, r.requestor_name)
  from public.requests r
  join public.shift_posts sp on sp.id = r.shift_id
  where r.status = 'pending_supervisor_approval'
    and sp.program_name = any(scoped_programs);

  return new;
end;
$$;

drop trigger if exists refresh_reviewer_role_assignments on public.users;
create trigger refresh_reviewer_role_assignments
after update of role on public.users
for each row execute function public.refresh_reviewer_role_assignments();

commit;
