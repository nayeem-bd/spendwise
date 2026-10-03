-- Receipt photos (PROJECT_PLAN Phase 3).
--
-- attachments: synced metadata rows (sync columns, RLS, server_seq trigger),
-- one per photo, linked to a transaction. The image itself lives in the
-- private Storage bucket 'receipts' at '<user_id>/<attachment_id>.jpg';
-- storage policies only allow each user their own folder.

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  transaction_id uuid not null references public.transactions on delete cascade,
  storage_path text not null check (storage_path like user_id::text || '/%'),
  content_type text not null default 'image/jpeg',
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 5 * 1024 * 1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_seq bigint
);

create index on public.attachments (user_id, server_seq);
create index on public.attachments (transaction_id);

create trigger trg_sync before insert or update on public.attachments
  for each row execute function public.bump_sync();

alter table public.attachments enable row level security;
create policy "own rows" on public.attachments for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Storage: private bucket, JPEG/PNG/WebP up to 5 MB, own folder only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "receipts: read own" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "receipts: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "receipts: update own" on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "receipts: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- push_changes: same as before plus the attachments table.
create or replace function public.push_changes(changes jsonb) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  change jsonb;
  tbl text;
  ids jsonb := '{}'::jsonb;  -- table -> [ids]
  result jsonb := '{}'::jsonb;
  rows jsonb;
begin
  if auth.uid() is null then
    raise exception 'push_changes requires a signed-in user' using errcode = '42501';
  end if;
  if jsonb_typeof(changes) <> 'array' then
    raise exception 'changes must be a JSON array' using errcode = '22023';
  end if;

  -- Serialize this user's pushes so their server_seq values commit in order.
  -- Otherwise a pull could pass a lower seq that commits later and miss it.
  perform pg_advisory_xact_lock(hashtextextended('push_changes:' || auth.uid()::text, 0));

  for change in select value from jsonb_array_elements(changes)
  loop
    tbl := change ->> 'table';
    ids := jsonb_set(ids, array[tbl], coalesce(ids -> tbl, '[]'::jsonb) || to_jsonb(change -> 'row' ->> 'id'));

    case tbl
    when 'accounts' then
      insert into public.accounts as t
        (id, user_id, name, initial_balance, icon, color, archived, created_at, updated_at, deleted_at)
      select id, user_id, name, initial_balance, icon, color, archived, created_at, updated_at, deleted_at
      from jsonb_populate_record(null::public.accounts, change -> 'row')
      on conflict (id) do update set
        name = excluded.name, initial_balance = excluded.initial_balance, icon = excluded.icon,
        color = excluded.color, archived = excluded.archived,
        updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
      where t.updated_at <= excluded.updated_at;

    when 'categories' then
      insert into public.categories as t
        (id, user_id, name, type, icon, color, sort_order, archived, created_at, updated_at, deleted_at)
      select id, user_id, name, type, icon, color, sort_order, archived, created_at, updated_at, deleted_at
      from jsonb_populate_record(null::public.categories, change -> 'row')
      on conflict (id) do update set
        name = excluded.name, type = excluded.type, icon = excluded.icon, color = excluded.color,
        sort_order = excluded.sort_order, archived = excluded.archived,
        updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
      where t.updated_at <= excluded.updated_at;

    when 'recurring_rules' then
      insert into public.recurring_rules as t
        (id, user_id, template, frequency, next_run, active, created_at, updated_at, deleted_at)
      select id, user_id, template, frequency, next_run, active, created_at, updated_at, deleted_at
      from jsonb_populate_record(null::public.recurring_rules, change -> 'row')
      on conflict (id) do update set
        template = excluded.template, frequency = excluded.frequency, next_run = excluded.next_run,
        active = excluded.active, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
      where t.updated_at <= excluded.updated_at;

    when 'transactions' then
      insert into public.transactions as t
        (id, user_id, account_id, category_id, type, amount, to_account_id, note, occurred_on,
         recurring_id, created_at, updated_at, deleted_at)
      select id, user_id, account_id, category_id, type, amount, to_account_id, note, occurred_on,
             recurring_id, created_at, updated_at, deleted_at
      from jsonb_populate_record(null::public.transactions, change -> 'row')
      on conflict (id) do update set
        account_id = excluded.account_id, category_id = excluded.category_id, type = excluded.type,
        amount = excluded.amount, to_account_id = excluded.to_account_id, note = excluded.note,
        occurred_on = excluded.occurred_on, recurring_id = excluded.recurring_id,
        updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
      where t.updated_at <= excluded.updated_at;

    when 'budgets' then
      insert into public.budgets as t
        (id, user_id, category_id, month, amount, created_at, updated_at, deleted_at)
      select id, user_id, category_id, month, amount, created_at, updated_at, deleted_at
      from jsonb_populate_record(null::public.budgets, change -> 'row')
      on conflict (id) do update set
        category_id = excluded.category_id, month = excluded.month, amount = excluded.amount,
        updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
      where t.updated_at <= excluded.updated_at;

    when 'attachments' then
      insert into public.attachments as t
        (id, user_id, transaction_id, storage_path, content_type, size_bytes, created_at, updated_at, deleted_at)
      select id, user_id, transaction_id, storage_path, content_type, size_bytes, created_at, updated_at, deleted_at
      from jsonb_populate_record(null::public.attachments, change -> 'row')
      on conflict (id) do update set
        transaction_id = excluded.transaction_id, storage_path = excluded.storage_path,
        content_type = excluded.content_type, size_bytes = excluded.size_bytes,
        updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
      where t.updated_at <= excluded.updated_at;

    else
      raise exception 'push_changes: unknown table %', tbl using errcode = '22023';
    end case;
  end loop;

  for tbl in select jsonb_object_keys(ids)
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I t
        where t.id in (select (jsonb_array_elements_text($1))::uuid)', tbl)
      into rows using ids -> tbl;
    result := jsonb_set(result, array[tbl], rows);
  end loop;

  return result;
end $$;

revoke execute on function public.push_changes(jsonb) from public, anon;
grant execute on function public.push_changes(jsonb) to authenticated;
