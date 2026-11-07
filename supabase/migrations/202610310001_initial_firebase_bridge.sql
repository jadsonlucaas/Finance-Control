begin;

create type public.account_status as enum ('active', 'pending', 'inactive');
create type public.account_role as enum ('owner', 'admin', 'user');

create table public.profiles (
  user_id text primary key,
  email text not null,
  role public.account_role not null default 'user',
  status public.account_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table public.identity_mappings (
  firebase_uid text primary key,
  supabase_user_id uuid unique,
  email_hash text not null,
  migrated_at timestamptz,
  migration_version integer not null default 1
);

create table public.finance_records (
  id text not null,
  owner_id text not null references public.profiles(user_id),
  type text not null,
  schema_version integer not null default 1,
  payload jsonb not null,
  competence text,
  occurred_date date,
  due_date date,
  status text,
  person text,
  amount_cents bigint,
  parent_id text,
  recurrence_series_id text,
  percentage_rule_id text,
  created_at timestamptz,
  updated_at timestamptz,
  primary key (owner_id, id),
  check (amount_cents is null or amount_cents between -9007199254740991 and 9007199254740991)
);

create table public.local_storage (
  owner_id text not null references public.profiles(user_id),
  key text not null,
  payload jsonb not null,
  updated_at timestamptz,
  primary key (owner_id, key)
);

create table public.audit_logs (
  id text not null,
  owner_id text not null references public.profiles(user_id),
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  primary key (owner_id, id)
);

create table public.idempotency_receipts (
  id text not null,
  owner_id text not null references public.profiles(user_id),
  operation text not null,
  status text not null,
  payload_hash text not null,
  created_at timestamptz not null,
  updated_at timestamptz,
  primary key (owner_id, id)
);

create table public.shared_macros (id text primary key, payload jsonb not null, updated_at timestamptz);
create table public.shared_categories (id text primary key, payload jsonb not null, updated_at timestamptz);
create table public.tax_parameters (id text primary key, payload jsonb not null, updated_at timestamptz);

create index finance_records_owner_type_idx on public.finance_records(owner_id, type);
create index finance_records_owner_competence_idx on public.finance_records(owner_id, competence);
create index finance_records_owner_status_idx on public.finance_records(owner_id, status);
create index finance_records_owner_occurred_idx on public.finance_records(owner_id, occurred_date);
create index finance_records_owner_due_idx on public.finance_records(owner_id, due_date);
create index finance_records_owner_person_idx on public.finance_records(owner_id, person);
create index finance_records_recurrence_idx on public.finance_records(recurrence_series_id);
create index finance_records_parent_idx on public.finance_records(parent_id);
create index finance_records_percentage_rule_idx on public.finance_records(percentage_rule_id);
create index audit_logs_owner_created_idx on public.audit_logs(owner_id, created_at desc);
create index profiles_admin_filters_idx on public.profiles(status, role, email);

alter table public.profiles enable row level security;
alter table public.identity_mappings enable row level security;
alter table public.finance_records enable row level security;
alter table public.local_storage enable row level security;
alter table public.audit_logs enable row level security;
alter table public.idempotency_receipts enable row level security;
alter table public.shared_macros enable row level security;
alter table public.shared_categories enable row level security;
alter table public.tax_parameters enable row level security;

create function public.firebase_uid() returns text language sql stable as $$
  select nullif(auth.jwt() ->> 'firebase_uid', '')
$$;
create function public.is_active() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where user_id = public.firebase_uid() and status = 'active')
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where user_id = public.firebase_uid() and status = 'active' and role in ('owner','admin'))
$$;

create policy profiles_self_select on public.profiles for select using (user_id = public.firebase_uid() or public.is_admin());
create policy finance_own_select on public.finance_records for select using (public.is_active() and owner_id = public.firebase_uid());
create policy finance_own_insert on public.finance_records for insert with check (public.is_active() and owner_id = public.firebase_uid());
create policy finance_own_update on public.finance_records for update using (public.is_active() and owner_id = public.firebase_uid()) with check (owner_id = public.firebase_uid());
create policy finance_own_delete on public.finance_records for delete using (public.is_active() and owner_id = public.firebase_uid());
create policy local_storage_own_all on public.local_storage for all using (public.is_active() and owner_id = public.firebase_uid()) with check (owner_id = public.firebase_uid());
create policy audit_own_select on public.audit_logs for select using (public.is_active() and owner_id = public.firebase_uid());
create policy audit_own_insert on public.audit_logs for insert with check (public.is_active() and owner_id = public.firebase_uid());
create policy receipts_own_all on public.idempotency_receipts for all using (public.is_active() and owner_id = public.firebase_uid()) with check (owner_id = public.firebase_uid());
create policy shared_macros_read on public.shared_macros for select using (public.is_active());
create policy shared_macros_admin_write on public.shared_macros for all using (public.is_admin()) with check (public.is_admin());
create policy shared_categories_read on public.shared_categories for select using (public.is_active());
create policy shared_categories_admin_write on public.shared_categories for all using (public.is_admin()) with check (public.is_admin());
create policy tax_parameters_read on public.tax_parameters for select using (public.is_active());
create policy tax_parameters_admin_write on public.tax_parameters for all using (public.is_admin()) with check (public.is_admin());

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on public.finance_records, public.local_storage, public.idempotency_receipts to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant select on public.profiles, public.shared_macros, public.shared_categories, public.tax_parameters to authenticated;

commit;
