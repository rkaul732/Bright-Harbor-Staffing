create extension if not exists "pgcrypto";

create type public.app_role as enum ('employee', 'supervisor', 'admin');
create type public.profile_status as enum ('pending', 'approved', 'suspended');
create type public.shift_category as enum ('standard', 'emergency');
create type public.shift_status as enum ('open', 'covered', 'cancelled', 'draft');
create type public.request_status as enum (
  'pending_supervisor_approval',
  'approved',
  'declined',
  'cancelled'
);
create type public.skill_name as enum (
  'Direct care',
  'Case management',
  'Driving',
  'Wraparound service coordination'
);

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role public.app_role not null default 'employee',
  avatar_url text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.worker_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  status public.profile_status not null default 'pending',
  program_name text not null default 'Community Resources for Emergency Support and Treatment (CREST)',
  program_names text[] not null default array['Community Resources for Emergency Support and Treatment (CREST)']::text[],
  availability jsonb not null default '[]'::jsonb,
  skills public.skill_name[] not null default '{}',
  account_information jsonb not null default '{}'::jsonb,
  photo_url text,
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supervisor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  status public.profile_status not null default 'pending',
  location_name text,
  front_desk_location_name text,
  title text,
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  status public.profile_status not null default 'pending',
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.shift_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  details text,
  program_name text not null default 'Community Resources for Emergency Support and Treatment (CREST)',
  location_id uuid references public.locations(id),
  location_name text not null,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  requirements public.skill_name[] not null default '{}',
  openings integer not null default 1 check (openings > 0),
  filled_openings integer not null default 0 check (filled_openings >= 0),
  pay_rate numeric(8, 2) not null default 17.00 check (pay_rate in (17.00, 19.00)),
  category public.shift_category not null default 'standard',
  urgent boolean not null default false,
  status public.shift_status not null default 'open',
  created_by uuid not null references public.users(id),
  posted_by_role public.app_role not null,
  owner_user_id uuid references public.users(id),
  supervisor_email text not null default 'bpataky@brightharbor.org',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint filled_not_over_openings check (filled_openings <= openings),
  constraint employee_posts_fixed_rate check (
    posted_by_role <> 'employee'
    or (
      pay_rate = 17.00
      and category = 'standard'
      and urgent = false
      and owner_user_id is not null
    )
  ),
  constraint category_rate_alignment check (
    (category = 'standard' and pay_rate = 17.00)
    or (category = 'emergency' and pay_rate = 19.00)
  )
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shift_posts(id) on delete cascade,
  requestor_id uuid not null references public.users(id) on delete cascade,
  requestor_name text not null,
  note text,
  status public.request_status not null default 'pending_supervisor_approval',
  supervisor_email text not null default 'bpataky@brightharbor.org',
  routed_at timestamptz not null default now(),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  unique (shift_id, requestor_id)
);

create table public.time_off_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  employee_name text not null,
  program_name text not null,
  start_date date not null,
  end_date date not null,
  reason text not null check (char_length(reason) > 0),
  status public.request_status not null default 'pending_supervisor_approval',
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz not null default now(),
  constraint time_off_date_order check (end_date >= start_date)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests(id) on delete cascade,
  shift_id uuid references public.shift_posts(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  sender_name text not null,
  recipient_id uuid references public.users(id) on delete cascade,
  body text not null check (char_length(body) > 0),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.reschedules (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shift_posts(id) on delete cascade,
  requested_by uuid not null references public.users(id) on delete cascade,
  old_shift_date date not null,
  old_start_time time not null,
  old_end_time time not null,
  new_shift_date date not null,
  new_start_time time not null,
  new_end_time time not null,
  reason text,
  status public.request_status not null default 'pending_supervisor_approval',
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.cancelations (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shift_posts(id) on delete cascade,
  requested_by uuid not null references public.users(id) on delete cascade,
  reason text,
  status public.request_status not null default 'pending_supervisor_approval',
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.saved_shifts (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shift_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shift_id, user_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  role text not null default 'all',
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.ad_slots (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  cta_label text not null,
  cta_href text not null,
  program_name text not null,
  placement text not null default 'dashboard',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  event_name text not null,
  role public.app_role,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.monthly_winners (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  user_id uuid not null references public.users(id) on delete cascade,
  worker_name text not null,
  approved_shift_count integer not null default 0,
  location_name text,
  created_at timestamptz not null default now(),
  unique (month, user_id)
);

create index shift_posts_date_idx on public.shift_posts (shift_date);
create index shift_posts_location_idx on public.shift_posts (location_name);
create index requests_status_idx on public.requests (status);
create index time_off_requests_user_idx on public.time_off_requests (user_id);
create index time_off_requests_status_idx on public.time_off_requests (status);
create index messages_request_idx on public.messages (request_id);
create index notifications_role_idx on public.notifications (role);

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger worker_profiles_touch_updated_at
before update on public.worker_profiles
for each row execute function public.touch_updated_at();

create trigger supervisor_profiles_touch_updated_at
before update on public.supervisor_profiles
for each row execute function public.touch_updated_at();

create trigger admin_profiles_touch_updated_at
before update on public.admin_profiles
for each row execute function public.touch_updated_at();

create trigger shift_posts_touch_updated_at
before update on public.shift_posts
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_role public.app_role;
begin
  profile_role := coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'employee');

  insert into public.users (id, email, full_name, role, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    profile_role,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role,
      avatar_url = excluded.avatar_url;

  if profile_role = 'employee' then
    insert into public.worker_profiles (user_id, program_name, program_names)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'program_name', 'Community Resources for Emergency Support and Treatment (CREST)'),
      case
        when jsonb_typeof(new.raw_user_meta_data -> 'program_names') = 'array'
        then array(
          select jsonb_array_elements_text(new.raw_user_meta_data -> 'program_names')
        )
        else array[coalesce(new.raw_user_meta_data ->> 'program_name', 'Community Resources for Emergency Support and Treatment (CREST)')]
      end
    )
    on conflict (user_id) do nothing;
  elsif profile_role = 'supervisor' then
    insert into public.supervisor_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  elsif profile_role = 'admin' then
    insert into public.admin_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.route_shift_request_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (role, title, body)
  values (
    'supervisor',
    'Shift approval needed',
    new.requestor_name || ' requested coverage. Approval routed to ' || new.supervisor_email || '.'
  );
  return new;
end;
$$;

create trigger request_routing_notification
after insert on public.requests
for each row execute function public.route_shift_request_notification();

create or replace function public.refresh_monthly_winners(target_month date default date_trunc('month', now())::date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.monthly_winners (month, user_id, worker_name, approved_shift_count, location_name)
  select
    target_month,
    r.requestor_id,
    max(r.requestor_name),
    count(*)::integer,
    max(s.location_name)
  from public.requests r
  join public.shift_posts s on s.id = r.shift_id
  where r.status = 'approved'
    and r.reviewed_at >= target_month
    and r.reviewed_at < (target_month + interval '1 month')
  group by r.requestor_id
  order by count(*) desc
  limit 1
  on conflict (month, user_id)
  do update set
    worker_name = excluded.worker_name,
    approved_shift_count = excluded.approved_shift_count,
    location_name = excluded.location_name,
    created_at = now();
end;
$$;

alter table public.users enable row level security;
alter table public.worker_profiles enable row level security;
alter table public.supervisor_profiles enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.locations enable row level security;
alter table public.shift_posts enable row level security;
alter table public.requests enable row level security;
alter table public.time_off_requests enable row level security;
alter table public.messages enable row level security;
alter table public.reschedules enable row level security;
alter table public.cancelations enable row level security;
alter table public.saved_shifts enable row level security;
alter table public.notifications enable row level security;
alter table public.ad_slots enable row level security;
alter table public.analytics_events enable row level security;
alter table public.monthly_winners enable row level security;

create policy "users read team directory"
on public.users for select
to authenticated
using (true);

create policy "users update own record"
on public.users for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles read"
on public.worker_profiles for select
to authenticated
using (true);

create policy "workers manage own profile"
on public.worker_profiles for all
to authenticated
using (user_id = auth.uid() or public.current_app_role() = 'admin')
with check (user_id = auth.uid() or public.current_app_role() = 'admin');

create policy "supervisor profiles read"
on public.supervisor_profiles for select
to authenticated
using (true);

create policy "supervisors manage own profile"
on public.supervisor_profiles for all
to authenticated
using (user_id = auth.uid() or public.current_app_role() = 'admin')
with check (user_id = auth.uid() or public.current_app_role() = 'admin');

create policy "admin profiles admin only"
on public.admin_profiles for all
to authenticated
using (user_id = auth.uid() or public.current_app_role() = 'admin')
with check (user_id = auth.uid() or public.current_app_role() = 'admin');

create policy "locations readable"
on public.locations for select
to authenticated
using (active = true);

create policy "locations admin writable"
on public.locations for all
to authenticated
using (public.current_app_role() in ('supervisor', 'admin'))
with check (public.current_app_role() in ('supervisor', 'admin'));

create policy "shifts readable"
on public.shift_posts for select
to authenticated
using (
  public.current_app_role() in ('supervisor', 'admin')
  or exists (
    select 1
    from public.worker_profiles wp
    where wp.user_id = auth.uid()
      and shift_posts.program_name = any(wp.program_names)
  )
);

create policy "employees supervisors admins create shifts"
on public.shift_posts for insert
to authenticated
with check (
  created_by = auth.uid()
  and posted_by_role = public.current_app_role()
  and (
    public.current_app_role() in ('supervisor', 'admin')
    or exists (
      select 1
      from public.worker_profiles wp
      where wp.user_id = auth.uid()
        and shift_posts.program_name = any(wp.program_names)
    )
  )
);

create policy "shift owners supervisors admins update"
on public.shift_posts for update
to authenticated
using (
  created_by = auth.uid()
  or owner_user_id = auth.uid()
  or public.current_app_role() in ('supervisor', 'admin')
)
with check (
  created_by = auth.uid()
  or owner_user_id = auth.uid()
  or public.current_app_role() in ('supervisor', 'admin')
);

create policy "requests readable by involved team"
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
  or public.current_app_role() in ('supervisor', 'admin')
);

create policy "workers create own requests"
on public.requests for insert
to authenticated
with check (
  requestor_id = auth.uid()
  and public.current_app_role() = 'employee'
  and exists (
    select 1
    from public.worker_profiles wp
    where wp.user_id = auth.uid()
      and exists (
        select 1
        from public.shift_posts sp
        where sp.id = requests.shift_id
          and sp.program_name = any(wp.program_names)
      )
  )
);

create policy "supervisors admins review requests"
on public.requests for update
to authenticated
using (public.current_app_role() in ('supervisor', 'admin'))
with check (public.current_app_role() in ('supervisor', 'admin'));

create policy "time off readable by involved team"
on public.time_off_requests for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_app_role() in ('supervisor', 'admin')
);

create policy "employees create own time off requests"
on public.time_off_requests for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.current_app_role() = 'employee'
  and exists (
    select 1
    from public.worker_profiles wp
    where wp.user_id = auth.uid()
      and time_off_requests.program_name = any(wp.program_names)
  )
);

create policy "supervisors admins review time off requests"
on public.time_off_requests for update
to authenticated
using (public.current_app_role() in ('supervisor', 'admin'))
with check (public.current_app_role() in ('supervisor', 'admin'));

create policy "messages readable by participants"
on public.messages for select
to authenticated
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
  or public.current_app_role() in ('supervisor', 'admin')
);

create policy "messages sent by user"
on public.messages for insert
to authenticated
with check (sender_id = auth.uid());

create policy "reschedules readable"
on public.reschedules for select
to authenticated
using (requested_by = auth.uid() or public.current_app_role() in ('supervisor', 'admin'));

create policy "reschedules insert"
on public.reschedules for insert
to authenticated
with check (requested_by = auth.uid());

create policy "cancelations readable"
on public.cancelations for select
to authenticated
using (requested_by = auth.uid() or public.current_app_role() in ('supervisor', 'admin'));

create policy "cancelations insert"
on public.cancelations for insert
to authenticated
with check (requested_by = auth.uid());

create policy "saved shifts own"
on public.saved_shifts for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "notifications read relevant"
on public.notifications for select
to authenticated
using (
  user_id = auth.uid()
  or role = 'all'
  or role = public.current_app_role()::text
);

create policy "notifications created by supervisors admins"
on public.notifications for insert
to authenticated
with check (public.current_app_role() in ('supervisor', 'admin'));

create policy "ads readable"
on public.ad_slots for select
to authenticated
using (active = true);

create policy "ads writable by admins"
on public.ad_slots for all
to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "analytics writable by authenticated"
on public.analytics_events for insert
to authenticated
with check (user_id = auth.uid() or user_id is null);

create policy "analytics readable by admins"
on public.analytics_events for select
to authenticated
using (public.current_app_role() = 'admin');

create policy "monthly winners readable"
on public.monthly_winners for select
to authenticated
using (true);

create policy "monthly winners admin writable"
on public.monthly_winners for all
to authenticated
using (public.current_app_role() = 'admin')
with check (public.current_app_role() = 'admin');

create policy "profile photos public read"
on storage.objects for select
using (bucket_id = 'profile-photos');

create policy "profile photos own upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "profile photos own update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
