-- Adds Code Red/Code Blue supervisor setup and captures employee availability at signup.
-- Safe to run more than once in the Supabase SQL Editor.

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
    insert into public.worker_profiles (user_id, program_name, program_names, availability)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'program_name', 'Community Resources for Emergency Support and Treatment (CREST)'),
      case
        when jsonb_typeof(new.raw_user_meta_data -> 'program_names') = 'array'
        then array(
          select jsonb_array_elements_text(new.raw_user_meta_data -> 'program_names')
        )
        else array[coalesce(new.raw_user_meta_data ->> 'program_name', 'Community Resources for Emergency Support and Treatment (CREST)')]
      end,
      case
        when jsonb_typeof(new.raw_user_meta_data -> 'availability') = 'array'
        then new.raw_user_meta_data -> 'availability'
        else '[]'::jsonb
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

do $$
declare
  sarah_user_id uuid := '00000000-0000-0000-0000-000000000202';
begin
  if exists (
    select 1
    from auth.users
    where lower(email) = 'spetrasek@brightharbor.org'
  ) then
    return;
  end if;

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    sarah_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'spetrasek@brightharbor.org',
    crypt('Bright123!', gen_salt('bf')),
    now(),
    '{"role":"supervisor","full_name":"Sarah Petrasek","setup_required":true,"program_name":"Code Red/Code Blue","program_names":["Code Red/Code Blue"]}'::jsonb,
    now(),
    now()
  );

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    sarah_user_id,
    'spetrasek@brightharbor.org',
    jsonb_build_object('sub', sarah_user_id::text, 'email', 'spetrasek@brightharbor.org'),
    'email',
    now(),
    now(),
    now()
  )
  on conflict (provider, provider_id) do nothing;

  insert into public.users (id, email, full_name, role)
  values (
    sarah_user_id,
    'spetrasek@brightharbor.org',
    'Sarah Petrasek',
    'supervisor'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role;

  insert into public.supervisor_profiles (
    user_id,
    status,
    location_name,
    front_desk_location_name,
    title
  )
  values (
    sarah_user_id,
    'pending',
    'Toms River',
    'Code Red/Code Blue',
    'Code Red/Code Blue Supervisor'
  )
  on conflict (user_id) do update
  set status = excluded.status,
      location_name = excluded.location_name,
      front_desk_location_name = excluded.front_desk_location_name,
      title = excluded.title;
end $$;
