alter table public.admin_profiles
  add column if not exists program_names text[] not null default '{}',
  add column if not exists is_super_admin boolean not null default false;

update public.admin_profiles ap
set is_super_admin = true,
    program_names = '{}'::text[]
from public.users u
where u.id = ap.user_id
  and lower(u.email) = 'rkaul@brightharbor.org';

create or replace function public.current_admin_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = auth.uid()
      and ap.status = 'approved'
      and ap.is_super_admin = true
  )
$$;

create or replace function public.current_admin_program_names()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select ap.program_names
      from public.admin_profiles ap
      where ap.user_id = auth.uid()
        and ap.status = 'approved'
      limit 1
    ),
    '{}'::text[]
  )
$$;

create or replace function public.current_admin_can_access_program(program_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin'
    and (
      public.current_admin_is_super_admin()
      or program_name = any(public.current_admin_program_names())
    )
$$;

drop policy if exists "profiles read" on public.worker_profiles;
drop policy if exists "workers manage own profile" on public.worker_profiles;
drop policy if exists "supervisor profiles read" on public.supervisor_profiles;
drop policy if exists "supervisors manage own profile" on public.supervisor_profiles;
drop policy if exists "admin profiles admin only" on public.admin_profiles;
drop policy if exists "shifts readable" on public.shift_posts;
drop policy if exists "employees supervisors admins create shifts" on public.shift_posts;
drop policy if exists "shift owners supervisors admins update" on public.shift_posts;
drop policy if exists "requests readable by involved team" on public.requests;
drop policy if exists "supervisors admins review requests" on public.requests;
drop policy if exists "time off readable by involved team" on public.time_off_requests;
drop policy if exists "supervisors admins review time off requests" on public.time_off_requests;
drop policy if exists "messages readable by participants" on public.messages;
drop policy if exists "reschedules readable" on public.reschedules;
drop policy if exists "cancelations readable" on public.cancelations;

create policy "worker profiles visible by role scope"
on public.worker_profiles for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_app_role() = 'supervisor'
  or public.current_admin_is_super_admin()
  or (
    public.current_app_role() = 'admin'
    and program_names && public.current_admin_program_names()
  )
);

create policy "workers manage own or scoped profile"
on public.worker_profiles for all
to authenticated
using (
  user_id = auth.uid()
  or public.current_admin_is_super_admin()
  or (
    public.current_app_role() = 'admin'
    and program_names <@ public.current_admin_program_names()
  )
)
with check (
  user_id = auth.uid()
  or public.current_admin_is_super_admin()
  or (
    public.current_app_role() = 'admin'
    and program_names <@ public.current_admin_program_names()
  )
);

create policy "supervisor profiles visible by role scope"
on public.supervisor_profiles for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_app_role() = 'supervisor'
  or public.current_admin_is_super_admin()
);

create policy "supervisors manage own or super admin"
on public.supervisor_profiles for all
to authenticated
using (user_id = auth.uid() or public.current_admin_is_super_admin())
with check (user_id = auth.uid() or public.current_admin_is_super_admin());

create policy "admin profiles read own or super admin"
on public.admin_profiles for select
to authenticated
using (user_id = auth.uid() or public.current_admin_is_super_admin());

create policy "admin profiles inserted by super admin"
on public.admin_profiles for insert
to authenticated
with check (public.current_admin_is_super_admin());

create policy "admin profiles updated by super admin"
on public.admin_profiles for update
to authenticated
using (public.current_admin_is_super_admin())
with check (public.current_admin_is_super_admin());

create policy "admin profiles deleted by super admin"
on public.admin_profiles for delete
to authenticated
using (public.current_admin_is_super_admin());

create policy "shifts readable by program scope"
on public.shift_posts for select
to authenticated
using (
  public.current_app_role() = 'supervisor'
  or public.current_admin_can_access_program(shift_posts.program_name)
  or exists (
    select 1
    from public.worker_profiles wp
    where wp.user_id = auth.uid()
      and shift_posts.program_name = any(wp.program_names)
  )
);

create policy "employees supervisors admins create scoped shifts"
on public.shift_posts for insert
to authenticated
with check (
  created_by = auth.uid()
  and posted_by_role = public.current_app_role()
  and (
    public.current_app_role() = 'supervisor'
    or public.current_admin_can_access_program(shift_posts.program_name)
    or exists (
      select 1
      from public.worker_profiles wp
      where wp.user_id = auth.uid()
        and shift_posts.program_name = any(wp.program_names)
    )
  )
);

create policy "shift owners supervisors scoped admins update"
on public.shift_posts for update
to authenticated
using (
  created_by = auth.uid()
  or owner_user_id = auth.uid()
  or public.current_app_role() = 'supervisor'
  or public.current_admin_can_access_program(shift_posts.program_name)
)
with check (
  created_by = auth.uid()
  or owner_user_id = auth.uid()
  or public.current_app_role() = 'supervisor'
  or public.current_admin_can_access_program(shift_posts.program_name)
);

create policy "requests readable by scoped team"
on public.requests for select
to authenticated
using (
  (
    requestor_id = auth.uid()
    and exists (
      select 1
      from public.worker_profiles wp
      join public.shift_posts sp on sp.id = requests.shift_id
      where wp.user_id = auth.uid()
        and sp.program_name = any(wp.program_names)
    )
  )
  or public.current_app_role() = 'supervisor'
  or exists (
    select 1
    from public.shift_posts sp
    where sp.id = requests.shift_id
      and public.current_admin_can_access_program(sp.program_name)
  )
);

create policy "supervisors scoped admins review requests"
on public.requests for update
to authenticated
using (
  public.current_app_role() = 'supervisor'
  or exists (
    select 1
    from public.shift_posts sp
    where sp.id = requests.shift_id
      and public.current_admin_can_access_program(sp.program_name)
  )
)
with check (
  public.current_app_role() = 'supervisor'
  or exists (
    select 1
    from public.shift_posts sp
    where sp.id = requests.shift_id
      and public.current_admin_can_access_program(sp.program_name)
  )
);

create policy "time off readable by scoped team"
on public.time_off_requests for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_app_role() = 'supervisor'
  or public.current_admin_can_access_program(time_off_requests.program_name)
);

create policy "supervisors scoped admins review time off requests"
on public.time_off_requests for update
to authenticated
using (
  public.current_app_role() = 'supervisor'
  or public.current_admin_can_access_program(time_off_requests.program_name)
)
with check (
  public.current_app_role() = 'supervisor'
  or public.current_admin_can_access_program(time_off_requests.program_name)
);

create policy "messages readable by scoped participants"
on public.messages for select
to authenticated
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
  or public.current_app_role() = 'supervisor'
  or public.current_admin_is_super_admin()
  or exists (
    select 1
    from public.shift_posts sp
    where sp.id = messages.shift_id
      and public.current_admin_can_access_program(sp.program_name)
  )
  or exists (
    select 1
    from public.requests r
    join public.shift_posts sp on sp.id = r.shift_id
    where r.id = messages.request_id
      and public.current_admin_can_access_program(sp.program_name)
  )
);

create policy "reschedules readable by scoped team"
on public.reschedules for select
to authenticated
using (
  requested_by = auth.uid()
  or public.current_app_role() = 'supervisor'
  or exists (
    select 1
    from public.shift_posts sp
    where sp.id = reschedules.shift_id
      and public.current_admin_can_access_program(sp.program_name)
  )
);

create policy "cancelations readable by scoped team"
on public.cancelations for select
to authenticated
using (
  requested_by = auth.uid()
  or public.current_app_role() = 'supervisor'
  or exists (
    select 1
    from public.shift_posts sp
    where sp.id = cancelations.shift_id
      and public.current_admin_can_access_program(sp.program_name)
  )
);
