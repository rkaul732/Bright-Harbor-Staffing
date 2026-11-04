-- Preserve each successful Auth sign-in for the Super Admin Activity page.
begin;

create table if not exists public.staff_login_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  signed_in_at timestamptz not null,
  is_prior_last_sign_in boolean not null default false,
  created_at timestamptz not null default now(),
  constraint staff_login_events_user_time_unique unique (user_id, signed_in_at)
);

create index if not exists staff_login_events_recent_idx
  on public.staff_login_events (signed_in_at desc, id desc);

create index if not exists staff_login_events_user_recent_idx
  on public.staff_login_events (user_id, signed_in_at desc, id desc);

alter table public.staff_login_events enable row level security;

drop policy if exists "super admins read staff login events" on public.staff_login_events;
create policy "super admins read staff login events"
on public.staff_login_events for select to authenticated
using (public.current_admin_is_super_admin());

revoke all on public.staff_login_events from public, anon, authenticated;
grant select on public.staff_login_events to authenticated;

create or replace function public.capture_staff_auth_sign_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_sign_in_at is not null
     and new.last_sign_in_at is distinct from old.last_sign_in_at then
    insert into public.staff_login_events (user_id, signed_in_at)
    select new.id, new.last_sign_in_at
    where exists (select 1 from public.users where id = new.id)
    on conflict (user_id, signed_in_at) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists capture_staff_auth_sign_in on auth.users;
create trigger capture_staff_auth_sign_in
after update of last_sign_in_at on auth.users
for each row execute function public.capture_staff_auth_sign_in();

-- Earlier individual sign-ins were not retained. Show the last known time for
-- each existing account, clearly labeled as a prior last sign-in in the UI.
insert into public.staff_login_events (user_id, signed_in_at, is_prior_last_sign_in)
select u.id, au.last_sign_in_at, true
from auth.users au
join public.users u on u.id = au.id
where au.last_sign_in_at is not null
on conflict (user_id, signed_in_at) do nothing;

commit;
