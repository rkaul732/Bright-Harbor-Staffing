alter table public.users
  add column if not exists account_type_changed_at timestamptz;
