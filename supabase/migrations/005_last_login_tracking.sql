alter table public.users
  add column if not exists last_sign_in_at timestamptz;

alter table public.worker_profiles
  add column if not exists last_sign_in_at timestamptz;

alter table public.supervisor_profiles
  add column if not exists last_sign_in_at timestamptz;

alter table public.admin_profiles
  add column if not exists last_sign_in_at timestamptz;

update public.users u
set last_sign_in_at = au.last_sign_in_at
from auth.users au
where au.id = u.id
  and u.last_sign_in_at is null
  and au.last_sign_in_at is not null;

update public.worker_profiles wp
set last_sign_in_at = u.last_sign_in_at
from public.users u
where u.id = wp.user_id
  and wp.last_sign_in_at is null
  and u.last_sign_in_at is not null;

update public.supervisor_profiles sp
set last_sign_in_at = u.last_sign_in_at
from public.users u
where u.id = sp.user_id
  and sp.last_sign_in_at is null
  and u.last_sign_in_at is not null;

update public.admin_profiles ap
set last_sign_in_at = u.last_sign_in_at
from public.users u
where u.id = ap.user_id
  and ap.last_sign_in_at is null
  and u.last_sign_in_at is not null;

create or replace function public.record_current_user_login(login_at timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  account_role public.app_role;
  account_user_id uuid := auth.uid();
begin
  if account_user_id is null then
    return;
  end if;

  update public.users
  set last_sign_in_at = login_at
  where id = account_user_id
  returning role into account_role;

  if account_role = 'employee' then
    update public.worker_profiles set last_sign_in_at = login_at where user_id = account_user_id;
  elsif account_role = 'supervisor' then
    update public.supervisor_profiles set last_sign_in_at = login_at where user_id = account_user_id;
  elsif account_role = 'admin' then
    update public.admin_profiles set last_sign_in_at = login_at where user_id = account_user_id;
  end if;
end;
$$;

grant execute on function public.record_current_user_login(timestamptz) to authenticated;
