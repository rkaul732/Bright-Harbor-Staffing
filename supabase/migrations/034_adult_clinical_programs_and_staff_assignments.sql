-- Add Adult Clinical program assignments and keep the employee's approved
-- time-off scope in sync with the program list shown on their profile.
begin;

do $$
declare
  employee_count integer;
  admin_count integer;
begin
  select count(*) into employee_count
  from public.users u
  join public.worker_profiles wp on wp.user_id = u.id
  where u.role = 'employee' and wp.status = 'approved'
    and lower(u.email) in (
      'asinger@brightharbor.org', 'slohr@brightharbor.org',
      'ekrakowski@brightharbor.org', 'mzanotti@brightharbor.org',
      'tfellenz@brightharbor.org', 'kchurpakovich@brightharbor.org',
      'mcolon@brightharbor.org', 'serli@brightharbor.org',
      'ktaylor@brightharbor.org', 'fgeller@brightharbor.org',
      'gcain@brightharbor.org', 'lamarshall@brightharbor.org',
      'kaitken@brightharbor.org', 'jboyle@brightharbor.org',
      'ascrofine@brightharbor.org', 'aminchala@brightharbor.org',
      'jwright@brightharbor.org'
    );
  if employee_count <> 17 then
    raise exception 'Expected 17 approved employee profiles, found %', employee_count;
  end if;

  select count(*) into admin_count
  from public.users u
  join public.admin_profiles ap on ap.user_id = u.id
  where u.role = 'admin' and ap.status = 'approved'
    and lower(u.email) in ('mcorrigan@brightharbor.org', 'mharper@brightharbor.org');
  if admin_count <> 2 then
    raise exception 'Expected both Adult Clinical admins, found %', admin_count;
  end if;
end;
$$;

-- Replace the current approved assignments for explicit moves.
update public.worker_profiles wp
set program_name = assignment.program_name,
    program_names = array[assignment.program_name]::text[],
    approved_program_names = array[assignment.program_name]::text[],
    status = 'approved'
from public.users u,
     (values
       ('asinger@brightharbor.org', 'Bright Horizons'),
       ('slohr@brightharbor.org', 'Outpatient Services'),
       ('ekrakowski@brightharbor.org', 'Outpatient Services'),
       ('mzanotti@brightharbor.org', 'On POINT'),
       ('tfellenz@brightharbor.org', 'Keeping Families Together - OCEAN'),
       ('kchurpakovich@brightharbor.org', 'Front Desk')
     ) as assignment(email, program_name)
where wp.user_id = u.id and lower(u.email) = assignment.email and u.role = 'employee';

-- These employees retain their existing approved programs as well.
update public.worker_profiles wp
set program_names = case when 'Nursing & Medical' = any(wp.program_names)
      then wp.program_names else array_append(wp.program_names, 'Nursing & Medical') end,
    approved_program_names = case when 'Nursing & Medical' = any(wp.approved_program_names)
      then wp.approved_program_names else array_append(wp.approved_program_names, 'Nursing & Medical') end
from public.users u
where wp.user_id = u.id and u.role = 'employee'
  and lower(u.email) in (
    'mcolon@brightharbor.org', 'serli@brightharbor.org',
    'ktaylor@brightharbor.org', 'fgeller@brightharbor.org',
    'gcain@brightharbor.org', 'lamarshall@brightharbor.org',
    'kaitken@brightharbor.org', 'jboyle@brightharbor.org',
    'ascrofine@brightharbor.org', 'aminchala@brightharbor.org',
    'jwright@brightharbor.org'
  );

-- Meghan and Michele administer Adult Clinical Services. Make both new
-- programs part of their approved scope so unassigned-supervisor fallback
-- requests from these programs have a reviewer.
update public.admin_profiles ap
set program_names = array(
  select distinct name
  from unnest(ap.program_names || array['Bright Horizons', 'Nursing & Medical']::text[]) as programs(name)
  order by name
)
from public.users u
where ap.user_id = u.id and u.role = 'admin'
  and lower(u.email) in ('mcorrigan@brightharbor.org', 'mharper@brightharbor.org');

commit;
