-- Account roles and ordinary profile fields stay usable while a program
-- change waits for review. Keep the last approved time-off programs separate
-- from the employee's requested program list.
begin;

alter table public.worker_profiles
  add column if not exists approved_program_names text[] not null default '{}'::text[];
alter table public.supervisor_profiles
  add column if not exists requested_program_names text[];
alter table public.admin_profiles
  add column if not exists requested_program_names text[];

-- Existing assignments were made before approval snapshots existed. Treat
-- them as the starting approved set, including profiles still marked pending
-- by the former account-approval workflow.
alter table public.worker_profiles disable trigger worker_profiles_touch_updated_at;
alter table public.supervisor_profiles disable trigger supervisor_profiles_touch_updated_at;
alter table public.admin_profiles disable trigger admin_profiles_touch_updated_at;

update public.worker_profiles
set approved_program_names = program_names,
    status = 'approved'
where status in ('pending', 'approved');

update public.supervisor_profiles sp
set status = 'approved'
from public.users u
where sp.user_id = u.id
  and sp.status = 'pending'
  and u.role in ('supervisor', 'admin');

update public.admin_profiles ap
set status = 'approved'
from public.users u
where ap.user_id = u.id
  and ap.status = 'pending'
  and u.role = 'admin';

alter table public.worker_profiles enable trigger worker_profiles_touch_updated_at;
alter table public.supervisor_profiles enable trigger supervisor_profiles_touch_updated_at;
alter table public.admin_profiles enable trigger admin_profiles_touch_updated_at;

-- Browser clients may edit their requested programs and personal details,
-- but cannot approve their own time-off scope or alter their assigned role.
create or replace function public.protect_staff_account_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated' and (
    new.role is distinct from old.role
    or new.email is distinct from old.email
    or new.account_type_changed_at is distinct from old.account_type_changed_at
  ) then
    raise exception 'Account role and status can only be changed by staff administration';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_staff_account_role on public.users;
create trigger protect_staff_account_role
before update on public.users
for each row execute function public.protect_staff_account_role();

create or replace function public.protect_worker_program_approval()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approved_program_names := '{}'::text[];
    new.approved_by := null;
    new.approved_at := null;
    new.status := case when cardinality(new.program_names) > 0
      then 'pending'::public.profile_status
      else 'approved'::public.profile_status end;
  else
    new.approved_program_names := old.approved_program_names;
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
    new.status := case
      when old.status = 'suspended' then 'suspended'::public.profile_status
      when new.program_names is distinct from old.program_names then
        case when new.program_names <@ old.approved_program_names
          and old.approved_program_names <@ new.program_names
          then 'approved'::public.profile_status
          else 'pending'::public.profile_status end
      else old.status
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_worker_program_approval on public.worker_profiles;
create trigger protect_worker_program_approval
before insert or update on public.worker_profiles
for each row execute function public.protect_worker_program_approval();

-- Reviewer program scopes are privileged data access. Staff can request a
-- change through the server, while the active scope remains in program_names.
drop policy if exists "admin profiles admin only" on public.admin_profiles;
create policy "admin profiles read by admins or owner"
on public.admin_profiles for select to authenticated
using (user_id = (select auth.uid()) or public.current_app_role() = 'admin');

drop policy if exists "super admins manage supervisor profiles" on public.supervisor_profiles;

drop policy if exists "workers manage own profile" on public.worker_profiles;
create policy "workers create own profile"
on public.worker_profiles for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "workers update own profile"
on public.worker_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "staff create own time off requests" on public.time_off_requests;
create policy "staff create own time off requests"
on public.time_off_requests for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    (
      public.current_app_role() = 'employee'
      and exists (
        select 1 from public.worker_profiles wp
        where wp.user_id = (select auth.uid())
          and wp.status <> 'suspended'
          and time_off_requests.program_name = any(wp.approved_program_names)
      )
    )
    or public.current_supervisor_can_access_program(program_name)
    or public.current_admin_can_access_program(program_name)
  )
);

commit;
