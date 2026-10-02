-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, instance_id, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- Seed trigger
select is((select count(*)::int from categories where user_id = '11111111-1111-1111-1111-111111111111'), 16, 'new user gets 16 default categories');
select is((select count(*)::int from accounts where user_id = '11111111-1111-1111-1111-111111111111'), 3, 'new user gets 3 default accounts');
select is(
  (select id from accounts where user_id = '11111111-1111-1111-1111-111111111111' and name = 'Cash'),
  extensions.uuid_generate_v5('11111111-1111-1111-1111-111111111111', 'account:cash'),
  'default ids are deterministic UUIDv5(user_id, key)');
select ok((select bool_and(server_seq is not null) from categories), 'seeded rows get a server_seq');

-- Act as user A
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select count(*)::int from accounts), 3, 'A sees only own accounts');

insert into transactions (id, user_id, type, amount, occurred_on)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'expense', 250.50, '2026-10-03');
create temp table seq_before as select server_seq from transactions where id = '33333333-3333-3333-3333-333333333333';
update transactions set note = 'tea' where id = '33333333-3333-3333-3333-333333333333';
select ok(
  (select server_seq from transactions where id = '33333333-3333-3333-3333-333333333333') > (select server_seq from seq_before),
  'update bumps server_seq');

select throws_ok(
  $$ insert into transactions (user_id, type, amount) values ('22222222-2222-2222-2222-222222222222', 'expense', 1) $$,
  '42501', null, 'cannot insert rows for another user');

insert into budgets (user_id, category_id, month, amount) values ('11111111-1111-1111-1111-111111111111', null, '2026-10-01', 100);
select throws_ok(
  $$ insert into budgets (user_id, category_id, month, amount) values ('11111111-1111-1111-1111-111111111111', null, '2026-10-01', 200) $$,
  '23505', null, 'only one whole-month budget per month');

-- Act as user B
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from transactions), 0, 'B cannot see A''s transactions');
update transactions set note = 'hacked';
reset role;
select is((select note from transactions where id = '33333333-3333-3333-3333-333333333333'), 'tea', 'B cannot update A''s transactions');

select * from finish();
rollback;
