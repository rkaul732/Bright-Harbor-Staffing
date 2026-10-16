-- Read-only checks to run in Supabase SQL Editor after migration 011.
select u.full_name, u.email, u.role, ap.status, ap.program_names
from public.users u
join public.admin_profiles ap on ap.user_id = u.id
where 'Integrated System of Care (ISC)' = any(ap.program_names)
order by u.full_name;

select u.full_name, u.email, u.role, sp.status, sp.program_names
from public.users u
join public.supervisor_profiles sp on sp.user_id = u.id
where 'Integrated System of Care (ISC)' = any(sp.program_names)
order by u.full_name;

select t.employee_name, t.program_name, t.status,
       recipient.full_name as notified_reviewer,
       recipient.email as reviewer_email,
       recipient.role as reviewer_role
from public.time_off_requests t
left join public.notifications n
  on n.request_kind = 'time-off' and n.request_id = t.id
left join public.users recipient on recipient.id = n.user_id
where lower(t.employee_name) = 'test test'
  and t.program_name = 'Integrated System of Care (ISC)'
order by t.created_at desc, recipient.full_name;
