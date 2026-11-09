-- Supervisor program and approval changes go through authenticated server actions.
-- A supervisor can still read their own profile, but cannot self-approve or
-- grant themselves additional program scope through the Supabase REST API.
begin;

drop policy if exists "supervisors manage own or super admin"
on public.supervisor_profiles;
drop policy if exists "supervisors manage own profile"
on public.supervisor_profiles;
drop policy if exists "super admins manage supervisor profiles"
on public.supervisor_profiles;

create policy "super admins manage supervisor profiles"
on public.supervisor_profiles for all
to authenticated
using (public.current_admin_is_super_admin())
with check (public.current_admin_is_super_admin());

commit;
