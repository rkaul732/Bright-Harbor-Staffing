-- Ocean Academy blackout dates and audited special approval for date overlaps.
begin;

create table if not exists public.ocean_academy_blackouts (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  note text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  constraint ocean_academy_blackout_valid_range check (end_date >= start_date),
  constraint ocean_academy_blackout_note_length check (char_length(note) <= 500)
);

create index if not exists ocean_academy_blackouts_dates_idx
  on public.ocean_academy_blackouts (start_date, end_date);

alter table public.ocean_academy_blackouts enable row level security;
grant select, insert on public.ocean_academy_blackouts to authenticated;

create policy "Ocean Academy team reads blackouts"
on public.ocean_academy_blackouts for select to authenticated
using (
  public.current_admin_can_access_program('Ocean Academy')
  or public.current_supervisor_can_access_program('Ocean Academy')
  or exists (
    select 1 from public.worker_profiles wp
    where wp.user_id = (select auth.uid())
      and 'Ocean Academy' = any(wp.approved_program_names)
  )
);

create policy "Ocean Academy reviewers add blackouts"
on public.ocean_academy_blackouts for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (
    public.current_admin_can_access_program('Ocean Academy')
    or public.current_supervisor_can_access_program('Ocean Academy')
  )
);

alter table public.time_off_requests
  add column if not exists special_approval_requested boolean not null default false,
  add column if not exists date_conflict boolean not null default false,
  add column if not exists blackout_conflict boolean not null default false;

create or replace function public.enforce_ocean_academy_special_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  approved_overlap boolean;
  blackout_overlap boolean;
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
      or new.program_name is distinct from old.program_name
      or new.start_date is distinct from old.start_date
      or new.end_date is distinct from old.end_date
      or new.special_approval_requested is distinct from old.special_approval_requested
      or new.date_conflict is distinct from old.date_conflict
      or new.blackout_conflict is distinct from old.blackout_conflict then
      raise exception 'Submitted time off dates and conflict flags cannot be changed';
    end if;
    if old.special_approval_requested
      and new.status is distinct from old.status
      and new.status in ('approved', 'declined')
      and auth.role() = 'authenticated'
      and not public.current_admin_can_access_program(old.program_name) then
      raise exception 'Ocean Academy special approval requires an assigned admin';
    end if;
    return new;
  end if;

  if new.program_name <> 'Ocean Academy' or new.status <> 'pending_supervisor_approval' then
    new.special_approval_requested := false;
    new.date_conflict := false;
    new.blackout_conflict := false;
    return new;
  end if;

  select exists (
    select 1 from public.time_off_requests t
    where t.program_name = 'Ocean Academy'
      and t.status = 'approved'
      and t.user_id <> new.user_id
      and t.start_date <= new.end_date
      and t.end_date >= new.start_date
  ) into approved_overlap;
  select exists (
    select 1 from public.ocean_academy_blackouts b
    where b.start_date <= new.end_date
      and b.end_date >= new.start_date
  ) into blackout_overlap;

  if (approved_overlap or blackout_overlap) and not new.special_approval_requested then
    raise exception 'Special admin approval acknowledgement is required for Ocean Academy date conflicts';
  end if;

  new.date_conflict := approved_overlap;
  new.blackout_conflict := blackout_overlap;
  new.special_approval_requested := approved_overlap or blackout_overlap;
  return new;
end;
$$;

drop trigger if exists enforce_ocean_academy_special_approval on public.time_off_requests;
create trigger enforce_ocean_academy_special_approval
before insert or update on public.time_off_requests
for each row execute function public.enforce_ocean_academy_special_approval();

drop policy if exists "assigned reviewers update time off requests" on public.time_off_requests;
create policy "assigned reviewers update time off requests"
on public.time_off_requests for update to authenticated
using (
  public.current_reviewer_can_decide_time_off(user_id, program_name)
  and (not special_approval_requested or public.current_admin_can_access_program(program_name))
)
with check (
  public.current_reviewer_can_decide_time_off(user_id, program_name)
  and (not special_approval_requested or public.current_admin_can_access_program(program_name))
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
    and public.current_reviewer_can_decide_time_off(t.user_id, t.program_name)
    and (not t.special_approval_requested or public.current_admin_can_access_program(t.program_name))
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
  from public.request_review_recipients(target_kind, target_program, requester_id) recipient
  where not needs_special_approval or recipient.role = 'admin'
  on conflict do nothing;
end;
$$;

commit;
