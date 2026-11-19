-- Special Ocean Academy requests go to assigned admins even when a program
-- supervisor handles ordinary requests.
begin;

create or replace function public.ocean_academy_special_reviewers(target_requester_id uuid)
returns table(user_id uuid, email text, full_name text, role text)
language sql stable security definer set search_path = public as $$
  select distinct u.id, u.email, u.full_name, u.role::text
  from public.users u
  join public.admin_profiles ap on ap.user_id = u.id
  where ap.status = 'approved'
    and u.role = 'admin'
    and u.id is distinct from target_requester_id
    and (ap.is_super_admin or public.reviewer_scope_includes_program('Ocean Academy', ap.program_names))
    and u.email ~* '^[^@[:space:]]+@brightharbor[.]org$'
  order by 3, 1
$$;

revoke all on function public.ocean_academy_special_reviewers(uuid)
  from public, anon, authenticated;
grant execute on function public.ocean_academy_special_reviewers(uuid) to service_role;

create or replace function public.current_reviewer_can_decide_ocean_special(requester_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_admin_can_access_program('Ocean Academy')
    and auth.uid() is distinct from requester_id
    and exists (
      select 1 from public.ocean_academy_special_reviewers(requester_id) reviewer
      where reviewer.user_id = auth.uid()
    )
$$;

revoke all on function public.current_reviewer_can_decide_ocean_special(uuid)
  from public, anon;
grant execute on function public.current_reviewer_can_decide_ocean_special(uuid)
  to authenticated;

drop policy if exists "assigned reviewers update time off requests" on public.time_off_requests;
create policy "assigned reviewers update time off requests"
on public.time_off_requests for update to authenticated
using (
  case when special_approval_requested
    then program_name = 'Ocean Academy' and public.current_reviewer_can_decide_ocean_special(user_id)
    else public.current_reviewer_can_decide_time_off(user_id, program_name)
  end
)
with check (
  case when special_approval_requested
    then program_name = 'Ocean Academy' and public.current_reviewer_can_decide_ocean_special(user_id)
    else public.current_reviewer_can_decide_time_off(user_id, program_name)
  end
);

create or replace function public.current_reviewable_time_off_request_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(t.id order by t.created_at desc), '{}'::uuid[])
  from public.time_off_requests t
  where (
      t.status = 'pending_supervisor_approval'
      or (
        t.status in ('approved', 'declined')
        and (
          exists (
            select 1 from public.time_off_review_assignments assignment
            where assignment.requester_id = t.user_id and assignment.reviewer_id = auth.uid()
          )
          or exists (
            select 1 from public.time_off_program_review_assignments assignment
            where assignment.program_name = t.program_name and assignment.reviewer_id = auth.uid()
          )
          or (
            auth.uid() = (select id from public.users where lower(email) = 'mharper@brightharbor.org')
            and exists (
              select 1 from public.users meghan
              where lower(meghan.email) = 'mcorrigan@brightharbor.org'
                and (
                  exists (
                    select 1 from public.time_off_review_assignments assignment
                    where assignment.requester_id = t.user_id and assignment.reviewer_id = meghan.id
                  )
                  or exists (
                    select 1 from public.time_off_program_review_assignments assignment
                    where assignment.program_name = t.program_name and assignment.reviewer_id = meghan.id
                  )
                )
            )
          )
        )
      )
    )
    and case when t.special_approval_requested
      then t.program_name = 'Ocean Academy' and public.current_reviewer_can_decide_ocean_special(t.user_id)
      else public.current_reviewer_can_decide_time_off(t.user_id, t.program_name)
    end
$$;

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
    case when needs_special_approval then 'Ocean Academy special approval needed'
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
    from public.ocean_academy_special_reviewers(requester_id) r
    where needs_special_approval
  ) recipient
  on conflict do nothing;
end;
$$;

commit;
