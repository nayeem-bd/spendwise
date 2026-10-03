-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, instance_id, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select public.push_changes($$[
  {"table": "transactions", "row": {"id": "70000000-0000-0000-0000-000000000001", "user_id": "11111111-1111-1111-1111-111111111111",
    "type": "expense", "amount": "100", "occurred_on": "2026-10-03",
    "created_at": "2026-10-03T10:00:00Z", "updated_at": "2026-10-03T10:00:00Z"}},
  {"table": "attachments", "row": {"id": "a0000000-0000-0000-0000-000000000001", "user_id": "11111111-1111-1111-1111-111111111111",
    "transaction_id": "70000000-0000-0000-0000-000000000001",
    "storage_path": "11111111-1111-1111-1111-111111111111/a0000000-0000-0000-0000-000000000001.jpg",
    "content_type": "image/jpeg", "size_bytes": 1234,
    "created_at": "2026-10-03T10:00:00Z", "updated_at": "2026-10-03T10:00:00Z"}}
]$$::jsonb);
select is((select count(*)::int from attachments), 1, 'push_changes stores attachments');
select ok((select server_seq is not null from attachments), 'attachments get a server_seq');

select throws_ok($$ insert into attachments (user_id, transaction_id, storage_path, size_bytes)
  values ('11111111-1111-1111-1111-111111111111', '70000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222/x.jpg', 10) $$,
  '23514', null, 'storage_path must be inside the owner''s folder');

-- Storage: own folder only.
select lives_ok($$ insert into storage.objects (bucket_id, name, owner_id)
  values ('receipts', '11111111-1111-1111-1111-111111111111/a.jpg', '11111111-1111-1111-1111-111111111111') $$,
  'can upload into own folder');
select throws_ok($$ insert into storage.objects (bucket_id, name, owner_id)
  values ('receipts', '22222222-2222-2222-2222-222222222222/b.jpg', '11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'cannot upload into another user''s folder');

set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from attachments), 0, 'B cannot see A''s attachments');
select is((select count(*)::int from storage.objects where bucket_id = 'receipts'), 0, 'B cannot see A''s receipt files');

reset role;
select is((select public from storage.buckets where id = 'receipts'), false, 'receipts bucket is private');

select * from finish();
rollback;
