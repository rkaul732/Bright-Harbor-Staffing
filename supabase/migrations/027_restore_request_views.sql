-- Restore request view tracking used by the New/Pending queue and member previews.
-- This table was defined in migration 010 but is absent from production.
create table if not exists public.request_views (
  reviewer_id uuid not null references public.users(id) on delete cascade,
  request_kind text not null check (request_kind in ('shift', 'time-off')),
  request_id uuid not null,
  viewed_at timestamptz not null default now(),
  primary key (reviewer_id, request_kind, request_id)
);

alter table public.request_views enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'request_views'
      and policyname = 'reviewers read own request views'
  ) then
    execute $policy$
      create policy "reviewers read own request views"
      on public.request_views for select to authenticated
      using (reviewer_id = auth.uid())
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'request_views'
      and policyname = 'reviewers mark visible requests viewed'
  ) then
    execute $policy$
      create policy "reviewers mark visible requests viewed"
      on public.request_views for insert to authenticated
      with check (
        reviewer_id = auth.uid()
        and public.current_app_role() in ('supervisor', 'admin')
        and (
          (request_kind = 'shift' and exists (
            select 1 from public.requests r where r.id = request_id
          ))
          or (request_kind = 'time-off' and exists (
            select 1 from public.time_off_requests t where t.id = request_id
          ))
        )
      )
    $policy$;
  end if;
end;
$$;

grant select, insert on public.request_views to authenticated;
