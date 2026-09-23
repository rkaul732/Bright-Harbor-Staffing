-- Adds/repairs the multi-program employee profile fields used by the profile editor.
-- Safe to run more than once in Supabase SQL Editor.

alter table public.worker_profiles
  add column if not exists program_name text not null default 'Community Resources for Emergency Support and Treatment (CREST)';

alter table public.worker_profiles
  add column if not exists program_names text[] not null default array['Community Resources for Emergency Support and Treatment (CREST)']::text[];

update public.worker_profiles
set program_names = array[program_name]::text[]
where program_names is null or cardinality(program_names) = 0;

create unique index if not exists worker_profiles_user_id_unique_idx
on public.worker_profiles (user_id);
