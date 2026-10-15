-- Require company email for employee signups and keep self-service accounts as employees.
create or replace function public.enforce_bright_harbor_employee_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if (new.invited_at is null or coalesce(new.raw_user_meta_data ->> 'role', 'employee') = 'employee')
      and coalesce(new.email, '') !~* '^[^@[:space:]]+@brightharbor[.]org$' then
      raise exception 'You must use your Bright Harbor Email.' using errcode = '22023';
    end if;
  elsif new.email is distinct from old.email
    and exists (select 1 from public.users where id = new.id and role = 'employee')
    and coalesce(new.email, '') !~* '^[^@[:space:]]+@brightharbor[.]org$' then
    raise exception 'You must use your Bright Harbor Email.' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_bright_harbor_employee_email on auth.users;
create trigger enforce_bright_harbor_employee_email
before insert or update of email on auth.users
for each row execute function public.enforce_bright_harbor_employee_email();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_role public.app_role;
begin
  -- Browser signup metadata is editable by the applicant. Only trusted invitations may set a staff role.
  profile_role := case
    when new.invited_at is null then 'employee'::public.app_role
    else coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'employee'::public.app_role)
  end;

  insert into public.users (id, email, full_name, role, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    profile_role,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role,
      avatar_url = excluded.avatar_url;

  if profile_role = 'employee' then
    insert into public.worker_profiles (user_id, program_name, program_names, availability)
    values (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'program_name', 'Community Resources for Emergency Support and Treatment (CREST)'),
      case
        when jsonb_typeof(new.raw_user_meta_data -> 'program_names') = 'array'
        then array(select jsonb_array_elements_text(new.raw_user_meta_data -> 'program_names'))
        else array[coalesce(new.raw_user_meta_data ->> 'program_name', 'Community Resources for Emergency Support and Treatment (CREST)')]
      end,
      case
        when jsonb_typeof(new.raw_user_meta_data -> 'availability') = 'array'
        then new.raw_user_meta_data -> 'availability'
        else '[]'::jsonb
      end
    )
    on conflict (user_id) do nothing;
  elsif profile_role = 'supervisor' then
    insert into public.supervisor_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  elsif profile_role = 'admin' then
    insert into public.admin_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

-- Employees can edit contact details, but only service-role actions may change account roles.
revoke update on public.users from public, anon, authenticated;
grant update (full_name, phone, avatar_url) on public.users to authenticated;

drop policy if exists "time off readable by involved team" on public.time_off_requests;
drop policy if exists "time off readable by scoped team" on public.time_off_requests;
create policy "time off readable by owner or approved reviewers"
on public.time_off_requests for select
to authenticated
using (
  user_id = auth.uid()
  or (
    public.current_app_role() = 'supervisor'
    and exists (
      select 1 from public.supervisor_profiles
      where user_id = auth.uid() and status = 'approved'
    )
  )
  or public.current_admin_can_access_program(time_off_requests.program_name)
);
