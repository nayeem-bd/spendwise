-- Shared wallet (PROJECT_PLAN Phase 3): share an account with family or a partner.
--
-- 1. Sync ordering across users. Until now only one user wrote the rows a
--    user can see, so a per-user lock kept server_seq in commit order. With
--    sharing, another user's write can take a lower server_seq but commit
--    later, and a pull that already passed it would never see it. Fix:
--    every write takes a shared advisory lock before taking its server_seq,
--    and pulls go through pull_changes(), which takes that lock exclusively
--    while it reads. A pull therefore never runs while a write is between
--    "got a server_seq" and "committed".
--
-- 2. account_members + invite codes. Membership changes only through
--    SECURITY DEFINER RPCs (create_account_invite, join_account,
--    leave_account, remove_account_member); clients can read but never write
--    membership rows, so nobody can add themselves to an account.
--
-- 3. Visibility: members see the shared account, every transaction on it,
--    their co-members' categories (to label those transactions) and
--    receipts on transactions they can see. Members can only write their
--    own rows, and only on accounts they own or belong to.

-- ---------------------------------------------------------------------------
-- 1. Sync ordering
-- ---------------------------------------------------------------------------

create or replace function public.bump_sync() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Shared: writers don't block each other. pull_changes takes it exclusively.
  perform pg_advisory_xact_lock_shared(hashtextextended('spendwise:sync_seq', 0));
  new.server_seq := nextval('public.sync_seq');
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Membership
-- ---------------------------------------------------------------------------

create table public.account_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_seq bigint,
  unique (account_id, user_id)
);

create index on public.account_members (user_id, server_seq);
create index on public.account_members (account_id);

create trigger trg_sync before insert or update on public.account_members
  for each row execute function public.bump_sync();

alter table public.account_members enable row level security;

create table public.account_invites (
  code text primary key,
  account_id uuid not null references public.accounts on delete cascade,
  created_by uuid not null references auth.users on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.account_invites enable row level security;
-- No policies on account_invites: only the RPCs below touch it.

-- Helpers (SECURITY DEFINER so policies can use them without RLS recursion).

create or replace function public.is_account_member(p_account uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.account_members m
    where m.account_id = p_account and m.user_id = auth.uid() and m.deleted_at is null
  )
$$;

/** True when the caller may put transactions on this account (null = no account). */
create or replace function public.can_use_account(p_account uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_account is null
    or exists (select 1 from public.accounts a where a.id = p_account and a.user_id = auth.uid())
    or public.is_account_member(p_account)
$$;

/** True when the caller and p_user are both active members of some account. */
create or replace function public.shares_account_with(p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.account_members me
    join public.account_members them on them.account_id = me.account_id
    where me.user_id = auth.uid() and them.user_id = p_user
      and me.deleted_at is null and them.deleted_at is null
  )
$$;

revoke execute on function public.is_account_member(uuid) from public, anon;
revoke execute on function public.can_use_account(uuid) from public, anon;
revoke execute on function public.shares_account_with(uuid) from public, anon;
grant execute on function public.is_account_member(uuid) to authenticated;
grant execute on function public.can_use_account(uuid) to authenticated;
grant execute on function public.shares_account_with(uuid) to authenticated;

-- Members see every membership row of their accounts (to list who shares
-- it) and their own rows even after leaving (so their devices notice).
create policy "members read" on public.account_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_account_member(account_id));

-- RPCs ----------------------------------------------------------------------

/** Owner: creates a 7-day invite code for one of their accounts. */
create or replace function public.create_account_invite(p_account uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_code text;
begin
  if not exists (select 1 from public.accounts where id = p_account and user_id = auth.uid() and deleted_at is null) then
    raise exception 'Only the owner can share this account' using errcode = '42501';
  end if;
  insert into public.account_members (account_id, user_id, email, role)
  values (p_account, auth.uid(), coalesce(auth.jwt() ->> 'email', ''), 'owner')
  on conflict (account_id, user_id) do update set deleted_at = null, updated_at = now();

  v_code := upper(encode(extensions.gen_random_bytes(5), 'hex')); -- 10 chars, 40 bits
  insert into public.account_invites (code, account_id, created_by, expires_at)
  values (v_code, p_account, auth.uid(), now() + interval '7 days');
  return v_code;
end $$;

/** Joins the account behind an invite code. Returns the account id. */
create or replace function public.join_account(p_code text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_invite public.account_invites;
begin
  select * into v_invite from public.account_invites
  where code = upper(trim(p_code)) and expires_at > now();
  if not found then
    raise exception 'That invite code is invalid or has expired' using errcode = '22023';
  end if;
  if exists (select 1 from public.accounts where id = v_invite.account_id and user_id = auth.uid()) then
    raise exception 'This is already your account' using errcode = '22023';
  end if;
  if exists (select 1 from public.accounts where id = v_invite.account_id and deleted_at is not null) then
    raise exception 'That invite code is invalid or has expired' using errcode = '22023';
  end if;

  insert into public.account_members (account_id, user_id, email, role)
  values (v_invite.account_id, auth.uid(), coalesce(auth.jwt() ->> 'email', ''), 'member')
  on conflict (account_id, user_id) do update set deleted_at = null, updated_at = now();

  -- Re-stamp the joiner's categories so co-members' devices pull them (they
  -- were written before sharing began, below those devices' last_seq).
  update public.categories set server_seq = server_seq where user_id = auth.uid();
  return v_invite.account_id;
end $$;

/** Member: stops sharing an account they joined. */
create or replace function public.leave_account(p_account uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.account_members set deleted_at = now(), updated_at = now()
  where account_id = p_account and user_id = auth.uid() and role = 'member' and deleted_at is null;
end $$;

/** Owner: removes someone from their account. */
create or replace function public.remove_account_member(p_account uuid, p_user uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.accounts where id = p_account and user_id = auth.uid()) then
    raise exception 'Only the owner can remove members' using errcode = '42501';
  end if;
  update public.account_members set deleted_at = now(), updated_at = now()
  where account_id = p_account and user_id = p_user and role = 'member' and deleted_at is null;
end $$;

revoke execute on function public.create_account_invite(uuid) from public, anon;
revoke execute on function public.join_account(text) from public, anon;
revoke execute on function public.leave_account(uuid) from public, anon;
revoke execute on function public.remove_account_member(uuid, uuid) from public, anon;
grant execute on function public.create_account_invite(uuid) to authenticated;
grant execute on function public.join_account(text) to authenticated;
grant execute on function public.leave_account(uuid) to authenticated;
grant execute on function public.remove_account_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Visibility (permissive policies are OR'ed with the existing "own rows")
-- ---------------------------------------------------------------------------

-- One SELECT policy per table (own or shared) and separate write policies,
-- replacing the catch-all "own rows" (avoids two permissive SELECT policies).

drop policy "own rows" on public.accounts;
create policy "read own or shared" on public.accounts for select to authenticated
  using ((select auth.uid()) = user_id or public.is_account_member(id));
create policy "insert own" on public.accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "update own" on public.accounts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own" on public.accounts for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy "own rows" on public.categories;
create policy "read own or shared" on public.categories for select to authenticated
  using ((select auth.uid()) = user_id or public.shares_account_with(user_id));
create policy "insert own" on public.categories for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "update own" on public.categories for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own" on public.categories for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Transactions: write own rows only, and only on accounts you can use.
drop policy "own rows" on public.transactions;
create policy "read own or shared" on public.transactions for select to authenticated
  using (
    (select auth.uid()) = user_id
    or public.is_account_member(account_id)
    or public.is_account_member(to_account_id)
  );
create policy "insert own" on public.transactions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.can_use_account(account_id)
    and public.can_use_account(to_account_id)
  );
create policy "update own" on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and public.can_use_account(account_id)
    and public.can_use_account(to_account_id)
  );
create policy "delete own" on public.transactions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Receipts on any transaction you can see (transactions RLS applies inside).
drop policy "own rows" on public.attachments;
create policy "read own or shared" on public.attachments for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.transactions t where t.id = transaction_id)
  );
create policy "insert own" on public.attachments for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "update own" on public.attachments for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own" on public.attachments for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "receipts: read shared" on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and exists (select 1 from public.attachments a where a.storage_path = name and a.deleted_at is null)
  );

-- ---------------------------------------------------------------------------
-- Pull through an RPC, holding the sync lock exclusively while reading
-- ---------------------------------------------------------------------------

create or replace function public.pull_changes(p_table text, p_since bigint, p_limit int) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rows jsonb;
begin
  if p_table not in ('accounts', 'categories', 'recurring_rules', 'transactions', 'budgets', 'attachments', 'account_members') then
    raise exception 'pull_changes: unknown table %', p_table using errcode = '22023';
  end if;
  -- Waits for writes that already took a server_seq to commit; new writes
  -- wait for this read. So nothing below the returned rows is still pending.
  perform pg_advisory_xact_lock(hashtextextended('spendwise:sync_seq', 0));
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(t) order by t.server_seq), ''[]''::jsonb)
       from (select * from public.%I where server_seq > $1 order by server_seq limit $2) t', p_table)
    into rows using p_since, least(greatest(p_limit, 1), 1000);
  return rows;
end $$;

revoke execute on function public.pull_changes(text, bigint, int) from public, anon;
grant execute on function public.pull_changes(text, bigint, int) to authenticated;
