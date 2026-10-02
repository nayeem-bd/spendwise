-- SpendWise initial schema (PROJECT_PLAN.md section 4).
--
-- Every synced table has:
--   id          uuid generated on the device
--   updated_at  set by the device on each edit, used for last-write-wins
--   deleted_at  soft delete; rows are never hard-deleted
--   server_seq  assigned by bump_sync() on every insert/update, used for pull sync
-- and RLS with an "own rows" policy.
--
-- Money is numeric(14,2) taka here; the device stores integer poisha and the
-- sync layer converts.

create extension if not exists "uuid-ossp" with schema extensions;

-- ---------------------------------------------------------------------------
-- Sync sequence and trigger
-- ---------------------------------------------------------------------------

-- One global sequence: a server-side counter that is immune to device clock errors.
create sequence public.sync_seq;

create or replace function public.bump_sync() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_seq := nextval('public.sync_seq');
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  month_start_day int not null default 1 check (month_start_day between 1 and 28),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_seq bigint
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,                   -- Cash, Bank, bKash, Nagad, Rocket
  initial_balance numeric(14,2) not null default 0,
  icon text,
  color text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_seq bigint
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  type text not null check (type in ('expense', 'income')),
  icon text,
  color text,
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_seq bigint
);

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  template jsonb not null,              -- amount, category, account, note
  frequency text check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  next_run date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_seq bigint
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  account_id uuid references public.accounts on delete set null,
  category_id uuid references public.categories on delete set null,
  type text not null check (type in ('expense', 'income', 'transfer')),
  amount numeric(14,2) not null check (amount > 0),
  to_account_id uuid references public.accounts,   -- only for transfers
  note text,
  occurred_on date not null default current_date,
  recurring_id uuid references public.recurring_rules on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_seq bigint
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  category_id uuid references public.categories on delete cascade,  -- null = whole month
  month date not null check (extract(day from month) = 1),          -- first day of the month
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_seq bigint,
  -- nulls not distinct: only one whole-month budget (category_id null) per month
  unique nulls not distinct (user_id, category_id, month)
);

create index on public.transactions (user_id, occurred_on);

-- ---------------------------------------------------------------------------
-- Sync triggers, pull indexes, RLS
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'accounts', 'categories', 'recurring_rules', 'transactions', 'budgets']
  loop
    execute format(
      'create trigger trg_sync before insert or update on public.%I
         for each row execute function public.bump_sync()', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;

  foreach t in array array['accounts', 'categories', 'recurring_rules', 'transactions', 'budgets']
  loop
    execute format('create index on public.%I (user_id, server_seq)', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- profiles is keyed by id (= auth.users.id) instead of user_id.
create index on public.profiles (id, server_seq);
create policy "own rows" on public.profiles for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Seed defaults for each new user
-- ---------------------------------------------------------------------------

-- Default row ids are deterministic: uuid_generate_v5(user_id, '<kind>:<key>').
-- The device computes the same UUIDv5 when it seeds offline, so the defaults
-- never duplicate across devices or between device and server.
create or replace function public.default_row_id(p_user_id uuid, p_key text) returns uuid
language sql
immutable
set search_path = ''
as $$
  select extensions.uuid_generate_v5(p_user_id, p_key)
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');

  insert into public.accounts (id, user_id, name, icon, color)
  select public.default_row_id(new.id, 'account:' || a.key), new.id, a.name, a.icon, a.color
  from (values
    ('cash',  'Cash',  'cash',      '#2E7D32'),
    ('bkash', 'bKash', 'cellphone', '#E2136E'),
    ('bank',  'Bank',  'bank',      '#1565C0')
  ) as a(key, name, icon, color);

  insert into public.categories (id, user_id, name, type, icon, color, sort_order)
  select public.default_row_id(new.id, 'category:' || c.key), new.id, c.name, c.type, c.icon, c.color, c.sort_order
  from (values
    ('food',            'Food & Groceries', 'expense', 'food-apple',       '#EF6C00', 0),
    ('transport',       'Transport',        'expense', 'bus',              '#1E88E5', 1),
    ('house_rent',      'House Rent',       'expense', 'home',             '#6D4C41', 2),
    ('utility_bills',   'Utility Bills',    'expense', 'flash',            '#FDD835', 3),
    ('mobile_recharge', 'Mobile Recharge',  'expense', 'cellphone',        '#00ACC1', 4),
    ('shopping',        'Shopping',         'expense', 'shopping',         '#D81B60', 5),
    ('health',          'Health',           'expense', 'medical-bag',      '#E53935', 6),
    ('education',       'Education',        'expense', 'school',           '#3949AB', 7),
    ('family_support',  'Family Support',   'expense', 'account-group',    '#8E24AA', 8),
    ('entertainment',   'Entertainment',    'expense', 'movie-open',       '#43A047', 9),
    ('other_expense',   'Other',            'expense', 'dots-horizontal',  '#757575', 10),
    ('salary',          'Salary',           'income',  'briefcase',        '#2E7D32', 0),
    ('business',        'Business',         'income',  'store',            '#00897B', 1),
    ('freelance',       'Freelance',        'income',  'laptop',           '#5E35B1', 2),
    ('gift',            'Gift',             'income',  'gift',             '#F4511E', 3),
    ('other_income',    'Other',            'income',  'dots-horizontal',  '#757575', 4)
  ) as c(key, name, type, icon, color, sort_order);

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
