-- Keep staffing history while removing a deleted employee from active views.
alter table public.users
  add column if not exists deleted_at timestamptz;

-- Supabase replaces the Auth email during soft deletion. Keep the company-email
-- rule for active accounts while allowing that Auth operation to finish.
create or replace function public.enforce_bright_harbor_employee_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if (new.invited_at is null or coalesce(new.raw_user_meta_data ->> 'role', 'employee') = 'employee')
      and coalesce(new.email, '') !~* '^[^@[:space:]]+@brightharbor[.]org$' then
      raise exception 'You must use your Bright Harbor Email.' using errcode = '22023';
    end if;
  elsif new.email is distinct from old.email
    and exists (select 1 from public.users where id = new.id and role = 'employee')
    and coalesce(new.email, '') !~* '^[^@[:space:]]+@brightharbor[.]org$' then
    raise exception 'You must use your Bright Harbor Email.' using errcode = '22023';
  end if;

  return new;
end;
$$;

create or replace function public.sync_deleted_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null and old.deleted_at is distinct from new.deleted_at then
    update public.users
    set deleted_at = new.deleted_at,
        email = 'deleted-' || new.id::text || '@deleted.brightharbor.invalid',
        full_name = 'Deleted employee',
        phone = null,
        avatar_url = null
    where id = new.id and role = 'employee';

    update public.worker_profiles
    set status = 'suspended',
        photo_url = null
    where user_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_deleted_auth_user on auth.users;
create trigger sync_deleted_auth_user
after update of deleted_at on auth.users
for each row execute function public.sync_deleted_auth_user();

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users
  where id = auth.uid() and deleted_at is null
$$;

drop policy if exists "users read team directory" on public.users;
create policy "users read active team directory"
on public.users for select to authenticated
using (deleted_at is null or id = auth.uid());

create or replace function public.current_account_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and deleted_at is null
  )
$$;

-- Existing access tokens cannot continue reading or writing staff data.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'users', 'worker_profiles', 'supervisor_profiles', 'admin_profiles',
    'shift_posts', 'requests', 'time_off_requests', 'messages',
    'reschedules', 'cancelations', 'saved_shifts', 'notifications',
    'ad_slots', 'analytics_events', 'monthly_winners', 'request_views',
    'automated_message_templates', 'automated_email_deliveries'
  ] loop
    execute format('drop policy if exists "active accounts only" on public.%I', table_name);
    execute format(
      'create policy "active accounts only" on public.%I as restrictive for all to authenticated using (public.current_account_active()) with check (public.current_account_active())',
      table_name
    );
  end loop;
end;
$$;
