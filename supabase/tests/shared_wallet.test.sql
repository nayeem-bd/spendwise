-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- A owns two accounts; B joins one; C is a stranger.
insert into auth.users (id, email, instance_id, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- Shorthands for the three ids and each user's seeded Cash account.
create temp table ids as select
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid a,
  'bbbbbbbb-0000-0000-0000-000000000002'::uuid b,
  'cccccccc-0000-0000-0000-000000000003'::uuid c,
  public.default_row_id('aaaaaaaa-0000-0000-0000-000000000001', 'account:cash') a_cash,
  public.default_row_id('aaaaaaaa-0000-0000-0000-000000000001', 'account:bank') a_bank,
  public.default_row_id('bbbbbbbb-0000-0000-0000-000000000002', 'account:cash') b_cash;
grant select on ids to authenticated;

create or replace function pg_temp.act_as(p_user uuid, p_email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'email', p_email)::text, true);
$$;

set local role authenticated;

-- A records an expense on Cash (to be shared) and one on Bank (private).
select pg_temp.act_as((select a from ids), 'a@test.local');
insert into transactions (id, user_id, account_id, type, amount, note)
  select '70000000-0000-0000-0000-0000000000a1', a, a_cash, 'expense', 100, 'A on shared cash' from ids;
insert into transactions (id, user_id, account_id, type, amount, note)
  select '70000000-0000-0000-0000-0000000000a2', a, a_bank, 'expense', 200, 'A private' from ids;

-- B: before joining, sees nothing of A's
select pg_temp.act_as((select b from ids), 'b@test.local');
select is((select count(*)::int from accounts where user_id = (select a from ids)), 0, 'before joining, B sees none of A''s accounts');
select throws_ok($$ insert into transactions (user_id, account_id, type, amount)
  select b, a_cash, 'expense', 1 from ids $$, '42501', null, 'B cannot add to A''s account before joining');
select throws_ok($$ select public.create_account_invite((select a_cash from ids)) $$, '42501', null, 'B cannot create an invite for A''s account');
select throws_ok($$ insert into account_members (account_id, user_id, email, role) select a_cash, b, 'b@test.local', 'member' from ids $$,
  '42501', null, 'B cannot add itself as a member directly');

-- A creates an invite
select pg_temp.act_as((select a from ids), 'a@test.local');
create temp table invite as select public.create_account_invite((select a_cash from ids)) as code;
grant select on invite to authenticated;
select is(length((select code from invite)), 10, 'invite code has 10 characters');
select is((select role from account_members where user_id = (select a from ids)), 'owner', 'creating an invite records the owner as a member');

-- B joins with the code (lower case and spaces are accepted)
select pg_temp.act_as((select b from ids), 'b@test.local');
select throws_ok($$ select public.join_account('NOPE000000') $$, '22023', 'That invite code is invalid or has expired', 'a wrong code is rejected');
select is(public.join_account('  ' || lower((select code from invite)) || ' '), (select a_cash from ids), 'B joins with the code');
select is((select count(*)::int from accounts where id = (select a_cash from ids)), 1, 'B now sees the shared account');
select is((select count(*)::int from accounts where id = (select a_bank from ids)), 0, 'B still cannot see A''s other account');
select is((select note from transactions where user_id = (select a from ids)), 'A on shared cash', 'B sees A''s transaction on the shared account only');
select ok((select count(*) > 0 from categories where user_id = (select a from ids)), 'B sees A''s category names (to label shared transactions)');
select is((select count(*)::int from account_members where account_id = (select a_cash from ids)), 2, 'B sees who shares the account');

-- B writes to the shared account, but not to A's other account or A's rows
insert into transactions (id, user_id, account_id, type, amount, note)
  select '70000000-0000-0000-0000-0000000000b1', b, a_cash, 'expense', 50, 'B on shared cash' from ids;
select pass('B can add a transaction to the shared account');
select throws_ok($$ insert into transactions (user_id, account_id, type, amount) select b, a_bank, 'expense', 1 from ids $$,
  '42501', null, 'B cannot add to A''s unshared account');
select throws_ok($$ insert into transactions (user_id, account_id, to_account_id, type, amount) select b, b_cash, a_bank, 'transfer', 1 from ids $$,
  '42501', null, 'B cannot transfer into A''s unshared account');
update transactions set note = 'hacked' where id = '70000000-0000-0000-0000-0000000000a1';
insert into transactions (id, user_id, account_id, type, amount, note)
  select '70000000-0000-0000-0000-0000000000b2', b, b_cash, 'expense', 70, 'B private' from ids;

-- A sees B's shared transaction but not B's private one; A's row is untouched
select pg_temp.act_as((select a from ids), 'a@test.local');
select is((select note from transactions where id = '70000000-0000-0000-0000-0000000000a1'), 'A on shared cash', 'B cannot edit A''s transaction');
select is((select note from transactions where user_id = (select b from ids)), 'B on shared cash', 'A sees B''s shared transaction, not B''s private one');

-- C, a stranger, sees none of it and cannot use the code to see more than it should
select pg_temp.act_as((select c from ids), 'c@test.local');
select is((select count(*)::int from transactions), 0, 'C sees no transactions of A or B');
select is((select count(*)::int from account_members), 0, 'C sees no memberships');
select throws_ok($$ select public.remove_account_member((select a_cash from ids), (select b from ids)) $$, '42501', null, 'C cannot remove members');

-- pull_changes respects RLS and validates the table name
select pg_temp.act_as((select b from ids), 'b@test.local');
select is(jsonb_array_length(public.pull_changes('transactions', 0, 100)), 3, 'pull_changes returns what B can see');
select throws_ok($$ select public.pull_changes('account_invites', 0, 10) $$, '22023', null, 'pull_changes rejects other tables');

-- B leaves: access ends, but B still sees its own (deleted) membership row
select public.leave_account((select a_cash from ids));
select is((select count(*)::int from accounts where id = (select a_cash from ids)), 0, 'after leaving, B no longer sees the account');
select is((select count(*)::int from transactions where user_id = (select a from ids)), 0, 'after leaving, B no longer sees A''s transactions');
select ok((select deleted_at is not null from account_members where user_id = (select b from ids)), 'B sees its own membership as ended');

select * from finish();
rollback;
