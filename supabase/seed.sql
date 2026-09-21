insert into public.locations (name)
values
  ('Point Pleasant'),
  ('Little Egg Harbor'),
  ('Berkeley'),
  ('Toms River')
on conflict (name) do nothing;

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
values
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'employee@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"role":"employee","full_name":"Jamie Rivera"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'morgan@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"role":"employee","full_name":"Morgan Lane"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'bpataky@brightharbor.org',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"role":"supervisor","full_name":"B. Pataky"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"role":"admin","full_name":"Alex Morgan"}',
    now(),
    now()
  )
on conflict (id) do nothing;

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
select
  gen_random_uuid(),
  id,
  email,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  now(),
  now(),
  now()
from auth.users
where email in (
  'employee@example.com',
  'morgan@example.com',
  'bpataky@brightharbor.org',
  'admin@example.com'
)
on conflict (provider, provider_id) do nothing;

update public.worker_profiles
set
  status = 'approved',
  program_name = 'Anchor',
  program_names = array['Anchor', 'Beacon', 'Bayside']::text[],
  availability = '["Weeknights", "Saturday mornings"]',
  skills = array['Direct care', 'Driving']::public.skill_name[],
  account_information = '{"preferredContact":"Text"}'
where user_id = '00000000-0000-0000-0000-000000000101';

update public.worker_profiles
set
  status = 'pending',
  program_name = 'Outpatient',
  program_names = array['Outpatient']::text[],
  availability = '["Weekends"]',
  skills = array['Case management', 'Wraparound service coordination']::public.skill_name[],
  account_information = '{"preferredContact":"Email"}'
where user_id = '00000000-0000-0000-0000-000000000102';

update public.supervisor_profiles
set
  status = 'approved',
  location_name = 'Toms River',
  front_desk_location_name = 'Toms River Staffing',
  title = 'Staffing Coordinator'
where user_id = '00000000-0000-0000-0000-000000000201';

update public.admin_profiles
set status = 'approved'
where user_id = '00000000-0000-0000-0000-000000000301';

insert into public.shift_posts (
  id,
  title,
  details,
  program_name,
  location_name,
  shift_date,
  start_time,
  end_time,
  requirements,
  openings,
  filled_openings,
  pay_rate,
  category,
  urgent,
  status,
  created_by,
  posted_by_role,
  owner_user_id,
  supervisor_email
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'Overnight direct care coverage',
    'One opening for overnight support and medication reminders.',
    'Anchor',
    'Toms River',
    current_date + interval '1 day',
    '22:00',
    '07:00',
    array['Direct care']::public.skill_name[],
    1,
    0,
    17,
    'standard',
    true,
    'open',
    '00000000-0000-0000-0000-000000000201',
    'supervisor',
    null,
    'bpataky@brightharbor.org'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Weekend driving support',
    'Transport residents to a community outing and provide direct support.',
    'Beacon',
    'Point Pleasant',
    current_date + interval '4 days',
    '09:00',
    '15:00',
    array['Driving', 'Direct care']::public.skill_name[],
    2,
    1,
    17,
    'standard',
    false,
    'open',
    '00000000-0000-0000-0000-000000000201',
    'supervisor',
    null,
    'bpataky@brightharbor.org'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'Coverage needed - Berkeley',
    'Family conflict came up and I need help covering this evening shift.',
    'Anchor',
    'Berkeley',
    current_date + interval '7 days',
    '15:00',
    '23:00',
    array['Direct care']::public.skill_name[],
    1,
    0,
    17,
    'standard',
    false,
    'open',
    '00000000-0000-0000-0000-000000000101',
    'employee',
    '00000000-0000-0000-0000-000000000101',
    'bpataky@brightharbor.org'
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'Emergency stabilization coverage',
    'Supervisor-designated emergency opening for immediate support.',
    'Code Red/Code Blue',
    'Little Egg Harbor',
    current_date,
    '16:00',
    '00:00',
    array['Direct care', 'Case management']::public.skill_name[],
    1,
    0,
    19,
    'emergency',
    true,
    'open',
    '00000000-0000-0000-0000-000000000301',
    'admin',
    null,
    'bpataky@brightharbor.org'
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'Anchor morning pickup',
    'Approved shift picked up by Jamie for Anchor coverage.',
    'Anchor',
    'Toms River',
    current_date + interval '2 days',
    '07:00',
    '11:00',
    array['Direct care']::public.skill_name[],
    1,
    1,
    17,
    'standard',
    false,
    'covered',
    '00000000-0000-0000-0000-000000000201',
    'supervisor',
    null,
    'bpataky@brightharbor.org'
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    'Anchor afternoon pickup',
    'Second approved shift picked up by Jamie for Anchor coverage.',
    'Anchor',
    'Toms River',
    current_date + interval '2 days',
    '12:00',
    '16:00',
    array['Direct care']::public.skill_name[],
    1,
    1,
    17,
    'standard',
    false,
    'covered',
    '00000000-0000-0000-0000-000000000201',
    'supervisor',
    null,
    'bpataky@brightharbor.org'
  )
on conflict (id) do nothing;

insert into public.requests (
  id,
  shift_id,
  requestor_id,
  requestor_name,
  note,
  status,
  supervisor_email
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000101',
    'Jamie Rivera',
    'I can take the second opening.',
    'pending_supervisor_approval',
    'bpataky@brightharbor.org'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000101',
    'Jamie Rivera',
    'Approved Anchor pickup.',
    'approved',
    'bpataky@brightharbor.org'
  ),
  (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000101',
    'Jamie Rivera',
    'Approved Anchor pickup.',
    'approved',
    'bpataky@brightharbor.org'
  )
on conflict (shift_id, requestor_id) do nothing;

insert into public.time_off_requests (
  id,
  user_id,
  employee_name,
  program_name,
  start_date,
  end_date,
  reason,
  status,
  reviewed_by,
  reviewed_at
)
values
  (
    '25000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000101',
    'Jamie Rivera',
    'Anchor',
    current_date + interval '14 days',
    current_date + interval '16 days',
    'Family event',
    'pending_supervisor_approval',
    null,
    null
  ),
  (
    '25000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000102',
    'Morgan Lane',
    'Outpatient',
    current_date + interval '6 days',
    current_date + interval '6 days',
    'Personal time',
    'pending_supervisor_approval',
    null,
    null
  ),
  (
    '25000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000101',
    'Jamie Rivera',
    'Bayside',
    current_date + interval '3 days',
    current_date + interval '3 days',
    'Bayside time off request',
    'pending_supervisor_approval',
    null,
    null
  )
on conflict (id) do nothing;

insert into public.messages (
  request_id,
  shift_id,
  sender_id,
  sender_name,
  recipient_id,
  body
)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000201',
  'B. Pataky',
  '00000000-0000-0000-0000-000000000101',
  'Thanks for requesting this. I am reviewing coverage needs now.'
);

insert into public.saved_shifts (shift_id, user_id)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000101'
)
on conflict (shift_id, user_id) do nothing;

insert into public.ad_slots (title, body, cta_label, cta_href, program_name, placement)
values
  (
    'Wraparound weekend pool',
    'Promote openings from wraparound coordination when weekend support gets tight.',
    'View program',
    '#',
    'Wraparound Services',
    'dashboard'
  ),
  (
    'Case management float list',
    'Share last minute office and field coverage with qualified employees.',
    'Open list',
    '#',
    'Case Management',
    'mobile'
  );

insert into public.monthly_winners (
  month,
  user_id,
  worker_name,
  approved_shift_count,
  location_name
)
values (
  date_trunc('month', now())::date,
  '00000000-0000-0000-0000-000000000101',
  'Jamie Rivera',
  12,
  'Toms River'
)
on conflict (month, user_id) do update
set approved_shift_count = excluded.approved_shift_count;
