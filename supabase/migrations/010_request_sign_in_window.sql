-- Keep the prior login so the dashboard can show requests received between sign-ins.
alter table public.users
  add column if not exists previous_sign_in_at timestamptz;

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
  set previous_sign_in_at = last_sign_in_at,
      last_sign_in_at = login_at
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

-- A reviewer can move a request from New to Pending without deciding it.
create table if not exists public.request_views (
  reviewer_id uuid not null references public.users(id) on delete cascade,
  request_kind text not null check (request_kind in ('shift', 'time-off')),
  request_id uuid not null,
  viewed_at timestamptz not null default now(),
  primary key (reviewer_id, request_kind, request_id)
);

alter table public.request_views enable row level security;

create policy "reviewers read own request views"
on public.request_views for select to authenticated
using (reviewer_id = auth.uid());

create policy "reviewers mark visible requests viewed"
on public.request_views for insert to authenticated
with check (
  reviewer_id = auth.uid()
  and public.current_app_role() in ('supervisor', 'admin')
  and (
    (request_kind = 'shift' and exists (
      select 1 from public.requests r where r.id = request_id
    ))
    or (request_kind = 'time-off' and exists (
      select 1 from public.time_off_requests t where t.id = request_id
    ))
  )
);

grant select, insert on public.request_views to authenticated;
