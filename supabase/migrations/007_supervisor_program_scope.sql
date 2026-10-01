-- Adds supervisor program scope for dashboard filtering and employee profile approvals.
-- Safe to run more than once in the Supabase SQL Editor.

alter table public.supervisor_profiles
  add column if not exists program_names text[] not null default '{}';

update public.supervisor_profiles sp
set program_names = array['Code Red/Code Blue']::text[]
from public.users u
where u.id = sp.user_id
  and lower(u.email) = 'spetrasek@brightharbor.org'
  and (sp.program_names is null or cardinality(sp.program_names) = 0);

update public.supervisor_profiles sp
set program_names = array[
  'Beacon/ Anchor',
  'Building Empowerment to Achieve Community Housing (BEACH)',
  'Chelsea',
  'Front Desk',
  'Wellness Assistance Valuing Excellence (WAVE)'
]::text[]
from public.users u
where u.id = sp.user_id
  and lower(u.email) = 'bpataky@brightharbor.org'
  and (sp.program_names is null or cardinality(sp.program_names) = 0);
