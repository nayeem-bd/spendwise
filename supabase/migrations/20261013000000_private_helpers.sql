-- Move the shared-wallet policy helpers out of the API.
--
-- They are SECURITY DEFINER so RLS policies can call them without recursion,
-- but in `public` PostgREST also exposed them as /rest/v1/rpc/... endpoints
-- (Supabase advisor: authenticated_security_definer_function_executable).
-- `private` is not an exposed schema. Policies refer to functions by OID,
-- so they keep working after the move. The sharing RPCs the app calls
-- (create_account_invite, join_account, leave_account,
-- remove_account_member) stay in public on purpose.

create schema if not exists private;
revoke all on schema private from public;
-- Policies run as the caller, so signed-in users need to be able to execute these.
grant usage on schema private to authenticated;

alter function public.is_account_member(uuid) set schema private;
alter function public.shares_account_with(uuid) set schema private;
alter function public.can_use_account(uuid) set schema private;

-- Its body named the old location of is_account_member.
create or replace function private.can_use_account(p_account uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_account is null
    or exists (select 1 from public.accounts a where a.id = p_account and a.user_id = auth.uid())
    or private.is_account_member(p_account)
$$;
