-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, instance_id, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- A new category and a transaction that uses it, in one push (parent first).
create temp table r1 as select public.push_changes($$[
  {"table": "categories", "row": {"id": "c0000000-0000-0000-0000-000000000001", "user_id": "11111111-1111-1111-1111-111111111111",
    "name": "Pets", "type": "expense", "icon": "paw", "color": "#795548", "sort_order": 11, "archived": false,
    "created_at": "2026-10-03T10:00:00Z", "updated_at": "2026-10-03T10:00:00Z", "deleted_at": null}},
  {"table": "transactions", "row": {"id": "70000000-0000-0000-0000-000000000001", "user_id": "11111111-1111-1111-1111-111111111111",
    "account_id": null, "category_id": "c0000000-0000-0000-0000-000000000001", "type": "expense", "amount": "250.50",
    "to_account_id": null, "note": "food", "occurred_on": "2026-10-03", "recurring_id": null,
    "created_at": "2026-10-03T10:00:00Z", "updated_at": "2026-10-03T10:00:00Z", "deleted_at": null}}
]$$::jsonb) as res;

select is((select amount from transactions where id = '70000000-0000-0000-0000-000000000001'), 250.50::numeric(14,2), 'insert stores the row');
select is(jsonb_array_length((select res -> 'transactions' from r1)), 1, 'returns the server row for each pushed id');
select ok((select (res -> 'transactions' -> 0 ->> 'server_seq') is not null from r1), 'returned row includes server_seq');

-- Newer edit wins.
select public.push_changes($$[{"table": "transactions", "row": {"id": "70000000-0000-0000-0000-000000000001",
  "user_id": "11111111-1111-1111-1111-111111111111", "category_id": "c0000000-0000-0000-0000-000000000001",
  "type": "expense", "amount": "300", "note": "newer", "occurred_on": "2026-10-03",
  "created_at": "2026-10-03T10:00:00Z", "updated_at": "2026-10-03T12:00:00Z", "deleted_at": null}}]$$::jsonb);
select is((select note from transactions where id = '70000000-0000-0000-0000-000000000001'), 'newer', 'newer edit wins');

-- Older edit loses, and the response carries the server's newer row.
create temp table r2 as select public.push_changes($$[{"table": "transactions", "row": {"id": "70000000-0000-0000-0000-000000000001",
  "user_id": "11111111-1111-1111-1111-111111111111", "category_id": "c0000000-0000-0000-0000-000000000001",
  "type": "expense", "amount": "1", "note": "older", "occurred_on": "2026-10-03",
  "created_at": "2026-10-03T10:00:00Z", "updated_at": "2026-10-03T11:00:00Z", "deleted_at": null}}]$$::jsonb) as res;
select is((select note from transactions where id = '70000000-0000-0000-0000-000000000001'), 'newer', 'older edit loses');
select is((select res -> 'transactions' -> 0 ->> 'note' from r2), 'newer', 'losing push gets the server version back');

-- Delete = newer update with deleted_at.
select public.push_changes($$[{"table": "transactions", "row": {"id": "70000000-0000-0000-0000-000000000001",
  "user_id": "11111111-1111-1111-1111-111111111111", "category_id": "c0000000-0000-0000-0000-000000000001",
  "type": "expense", "amount": "300", "note": "newer", "occurred_on": "2026-10-03",
  "created_at": "2026-10-03T10:00:00Z", "updated_at": "2026-10-03T13:00:00Z", "deleted_at": "2026-10-03T13:00:00Z"}}]$$::jsonb);
select ok((select deleted_at is not null from transactions where id = '70000000-0000-0000-0000-000000000001'), 'delete syncs as deleted_at');

-- Same push twice (app killed before it cleared the outbox) creates no duplicate.
select public.push_changes($$[{"table": "categories", "row": {"id": "c0000000-0000-0000-0000-000000000001",
  "user_id": "11111111-1111-1111-1111-111111111111", "name": "Pets", "type": "expense", "icon": "paw", "color": "#795548",
  "sort_order": 11, "archived": false, "created_at": "2026-10-03T10:00:00Z", "updated_at": "2026-10-03T10:00:00Z", "deleted_at": null}}]$$::jsonb);
select is((select count(*)::int from categories where name = 'Pets'), 1, 're-pushing is idempotent');

-- All or nothing: a bad row rolls back the whole push.
select throws_ok($$ select public.push_changes('[
  {"table": "categories", "row": {"id": "c0000000-0000-0000-0000-000000000002", "user_id": "11111111-1111-1111-1111-111111111111",
    "name": "Ghost", "type": "expense", "sort_order": 0, "archived": false,
    "created_at": "2026-10-03T10:00:00Z", "updated_at": "2026-10-03T10:00:00Z"}},
  {"table": "transactions", "row": {"id": "70000000-0000-0000-0000-000000000002", "user_id": "11111111-1111-1111-1111-111111111111",
    "type": "expense", "amount": "-5", "occurred_on": "2026-10-03",
    "created_at": "2026-10-03T10:00:00Z", "updated_at": "2026-10-03T10:00:00Z"}}
]'::jsonb) $$, '23514', null, 'invalid row fails the push');
select is((select count(*)::int from categories where name = 'Ghost'), 0, 'failed push saves nothing');

select throws_ok($$ select public.push_changes('[{"table": "profiles", "row": {"id": "11111111-1111-1111-1111-111111111111"}}]'::jsonb) $$,
  '22023', null, 'unknown tables are rejected');

-- Cannot write another user's rows.
select throws_ok($$ select public.push_changes('[{"table": "categories", "row": {"id": "c0000000-0000-0000-0000-000000000003",
  "user_id": "22222222-2222-2222-2222-222222222222", "name": "Hijack", "type": "expense", "sort_order": 0, "archived": false,
  "created_at": "2026-10-03T10:00:00Z", "updated_at": "2026-10-03T10:00:00Z"}}]'::jsonb) $$,
  '42501', null, 'cannot insert rows for another user');

reset role;
set local role anon;
select throws_ok($$ select public.push_changes('[]'::jsonb) $$, '42501', null, 'anon cannot call push_changes');

select * from finish();
rollback;
