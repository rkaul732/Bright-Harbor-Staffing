-- Keep Ocean Academy's named reviewers together for staff requests. Special
-- approval decisions remain restricted to assigned admins.
begin;

create or replace function public.request_review_recipients(
  target_kind text,
  target_program text,
  target_requester_id uuid
)
returns table(user_id uuid, email text, full_name text, role text)
language sql stable security definer set search_path = public as $$
  with base_recipients as (
    select recipient.user_id, recipient.email, recipient.full_name, recipient.role
    from public.request_review_recipients_core(
      case
        when target_kind = 'shift' and target_program = 'Ocean Academy'
          and (select u.role::text from public.users u where u.id = target_requester_id) <> 'employee'
        then 'time-off'
        else target_kind
      end,
      target_program, target_requester_id
    ) recipient
  ), michele_peer as (
    select michele.id as user_id, michele.email, michele.full_name,
      michele.role::text as role
    from base_recipients meghan_recipient
    join public.users meghan on meghan.id = meghan_recipient.user_id
    join public.users michele on lower(michele.email) = 'mharper@brightharbor.org'
    join public.admin_profiles michele_admin
      on michele_admin.user_id = michele.id and michele_admin.status = 'approved'
    where target_kind = 'time-off'
      and lower(meghan.email) = 'mcorrigan@brightharbor.org'
      and michele.id is distinct from target_requester_id
      and michele.role = 'admin'
  ), ocean_staff_admin as (
    select u.id as user_id, u.email, u.full_name, u.role::text as role
    from public.users u
    join public.admin_profiles ap on ap.user_id = u.id
    where target_kind in ('time-off', 'shift')
      and target_program = 'Ocean Academy'
      and (select requester.role::text from public.users requester
        where requester.id = target_requester_id) = 'employee'
      and lower(u.email) = 'tnormile@brightharbor.org'
      and u.id is distinct from target_requester_id
      and u.role = 'admin'
      and ap.status = 'approved'
      and public.reviewer_scope_includes_program('Ocean Academy', ap.program_names)
  )
  select base.user_id, base.email, base.full_name, base.role from base_recipients base
  union
  select peer.user_id, peer.email, peer.full_name, peer.role from michele_peer peer
  union
  select ocean.user_id, ocean.email, ocean.full_name, ocean.role from ocean_staff_admin ocean
  order by full_name, user_id
$$;

revoke all on function public.request_review_recipients(text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.request_review_recipients(text, text, uuid)
  to service_role;

-- Supervisors are informed about an employee's special request, while the
-- assigned admin makes the decision. Supervisor and admin time off continues
-- up the review hierarchy, so peers do not receive those private requests.
create or replace function public.ocean_academy_special_notification_recipients(target_requester_id uuid)
returns table(user_id uuid, email text, full_name text, role text)
language sql stable security definer set search_path = public as $$
  with requester as (
    select u.role::text as role from public.users u where u.id = target_requester_id
  ), named_recipients as (
    select u.id as user_id, u.email, u.full_name, u.role::text as role
    from public.users u
    where u.id is distinct from target_requester_id
      and u.email ~* '^[^@[:space:]]+@brightharbor[.]org$'
      and (
        (
          lower(u.email) = 'tnormile@brightharbor.org'
          and u.role = 'admin'
          and exists (
            select 1 from public.admin_profiles ap
            where ap.user_id = u.id and ap.status = 'approved'
              and public.reviewer_scope_includes_program('Ocean Academy', ap.program_names)
          )
        )
        or (
          lower(u.email) in ('htobia@brightharbor.org', 'mdaniele@brightharbor.org')
          and (select requester.role from requester) = 'employee'
          and u.role = 'supervisor'
          and exists (
            select 1 from public.supervisor_profiles sp
            where sp.user_id = u.id and sp.status = 'approved'
              and public.reviewer_scope_includes_program('Ocean Academy', sp.program_names)
          )
        )
      )
  ), fallback_recipients as (
    select reviewer.user_id, reviewer.email, reviewer.full_name, reviewer.role
    from public.ocean_academy_special_reviewers(target_requester_id) reviewer
    where not exists (select 1 from named_recipients named where named.role = 'admin')
  )
  select named.user_id, named.email, named.full_name, named.role
  from named_recipients named
  union
  select fallback.user_id, fallback.email, fallback.full_name, fallback.role
  from fallback_recipients fallback
  order by full_name, user_id
$$;

revoke all on function public.ocean_academy_special_notification_recipients(uuid)
  from public, anon, authenticated;
grant execute on function public.ocean_academy_special_notification_recipients(uuid)
  to service_role;

create or replace function public.notify_program_reviewers(
  target_request_id uuid,
  target_kind text,
  target_program text,
  requester_name text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  requester_id uuid;
  needs_special_approval boolean := false;
begin
  if target_kind = 'time-off' then
    select t.user_id, t.special_approval_requested
      into requester_id, needs_special_approval
    from public.time_off_requests t where t.id = target_request_id;
  else
    select r.requestor_id into requester_id from public.requests r where r.id = target_request_id;
  end if;

  insert into public.notifications (user_id, role, title, body, request_kind, request_id)
  select recipient.user_id, recipient.role,
    case when needs_special_approval and recipient.role = 'supervisor'
      then 'Ocean Academy special request submitted'
      when needs_special_approval then 'Ocean Academy special approval needed'
      when target_kind = 'time-off' then 'Time off approval needed'
      else 'Shift approval needed' end,
    requester_name || ' submitted a ' ||
      case when target_kind = 'time-off' then 'time off' else 'shift coverage' end ||
      ' request for ' || target_program ||
      case when needs_special_approval then ' that needs special admin approval.' else '.' end,
    target_kind, target_request_id
  from (
    select r.user_id, r.role
    from public.request_review_recipients(target_kind, target_program, requester_id) r
    where not needs_special_approval
    union
    select r.user_id, r.role
    from public.ocean_academy_special_notification_recipients(requester_id) r
    where needs_special_approval
  ) recipient
  on conflict do nothing;
end;
$$;

do $$
declare
  sample_requester uuid;
begin
  select u.id into sample_requester
  from public.users u
  join public.worker_profiles wp on wp.user_id = u.id
  where u.role = 'employee' and 'Ocean Academy' = any(wp.approved_program_names)
  limit 1;
  if sample_requester is null then
    raise exception 'No Ocean Academy employee is available to verify reviewer routing';
  end if;
  if (
    select array_agg(lower(r.email) order by lower(r.email))
    from public.request_review_recipients('time-off', 'Ocean Academy', sample_requester) r
  ) is distinct from array[
    'htobia@brightharbor.org', 'mdaniele@brightharbor.org', 'tnormile@brightharbor.org'
  ]::text[] then
    raise exception 'Ordinary Ocean Academy time off is not routed to all three reviewers';
  end if;
  if (
    select array_agg(lower(r.email) order by lower(r.email))
    from public.request_review_recipients('shift', 'Ocean Academy', sample_requester) r
  ) is distinct from array[
    'htobia@brightharbor.org', 'mdaniele@brightharbor.org', 'tnormile@brightharbor.org'
  ]::text[] then
    raise exception 'Ocean Academy shift coverage is not routed to all three reviewers';
  end if;
  if (
    select array_agg(lower(r.email) order by lower(r.email))
    from public.ocean_academy_special_notification_recipients(sample_requester) r
  ) is distinct from array[
    'htobia@brightharbor.org', 'mdaniele@brightharbor.org', 'tnormile@brightharbor.org'
  ]::text[] then
    raise exception 'Special Ocean Academy time off is not routed to all three reviewers';
  end if;
end;
$$;

commit;
