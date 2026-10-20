-- Replace legacy PACT account assignments with both distinct PACT programs.
-- Safe to run more than once. Historical single-program requests and shifts
-- cannot be assigned to PACT I or PACT II without reviewing each record.

create or replace function pg_temp.expand_legacy_pact_programs(assigned text[])
returns text[]
language sql
as $$
  select array_agg(distinct program_name order by program_name)
  from unnest(
    array_remove(coalesce(assigned, '{}'::text[]), 'PACT') || array['PACT I', 'PACT II']::text[]
  ) as expanded(program_name);
$$;

update public.worker_profiles
set program_name = case when program_name = 'PACT' then 'PACT I' else program_name end,
    program_names = pg_temp.expand_legacy_pact_programs(program_names)
where program_name = 'PACT' or 'PACT' = any(program_names);

update public.supervisor_profiles
set program_names = pg_temp.expand_legacy_pact_programs(program_names)
where 'PACT' = any(program_names);

update public.admin_profiles
set program_names = pg_temp.expand_legacy_pact_programs(program_names)
where 'PACT' = any(program_names);

update public.automated_message_templates
set program_names = pg_temp.expand_legacy_pact_programs(program_names)
where 'PACT' = any(program_names);

update auth.users
set raw_user_meta_data = jsonb_set(
  case
    when raw_user_meta_data ->> 'program_name' = 'PACT'
      then jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{program_name}', to_jsonb('PACT I'::text))
    else coalesce(raw_user_meta_data, '{}'::jsonb)
  end,
  '{program_names}',
  to_jsonb(pg_temp.expand_legacy_pact_programs(
    case
      when jsonb_typeof(raw_user_meta_data -> 'program_names') = 'array'
        then array(select jsonb_array_elements_text(raw_user_meta_data -> 'program_names'))
      else '{}'::text[]
    end
  ))
)
where raw_user_meta_data ->> 'program_name' = 'PACT'
   or (raw_user_meta_data -> 'program_names') ? 'PACT';

-- Review these historical rows individually. Their original PACT assignment
-- does not identify which of the two programs owned the request or shift.
select 'time_off_requests' as source, count(*) as needs_program_review
from public.time_off_requests where program_name = 'PACT'
union all
select 'shift_posts', count(*)
from public.shift_posts where program_name = 'PACT'
union all
select 'ad_slots', count(*)
from public.ad_slots where program_name = 'PACT'
union all
select 'automated_email_deliveries', count(*)
from public.automated_email_deliveries where program_name = 'PACT';
