-- Savings accounts (DPS, FDR, emergency fund): a flag on accounts. Rows on a
-- savings account are left out of income/expense totals on the device; the
-- server only stores and syncs the flag.

alter table public.accounts add column savings boolean not null default false;

-- push_changes: same as before, plus accounts.savings.
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
        (id, user_id, name, initial_balance, icon, color, archived, savings, created_at, updated_at, deleted_at)
      -- Older app versions don't send savings: insert false, and keep the stored value on update.
      select id, user_id, name, initial_balance, icon, color, archived, coalesce(savings, false), created_at, updated_at, deleted_at
      from jsonb_populate_record(null::public.accounts, change -> 'row')
      on conflict (id) do update set
        name = excluded.name, initial_balance = excluded.initial_balance, icon = excluded.icon,
        color = excluded.color, archived = excluded.archived, savings = case when change -> 'row' ? 'savings' then excluded.savings else t.savings end,
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
