import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/lib/database.types';

import type { PushResult, SyncBackend } from './backend';
import type { ServerRow } from './mapping';

export class SyncError extends Error {
  constructor(
    message: string,
    readonly offline = false,
  ) {
    super(message);
  }
}

const isNetworkError = (message: string) => /fetch|network|timed? ?out|load failed/i.test(message);

function fail(error: { message: string }): never {
  throw new SyncError(error.message, isNetworkError(error.message));
}

async function call<T>(run: () => PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  let response;
  try {
    response = await run();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new SyncError(message, isNetworkError(message));
  }
  if (response.error) fail(response.error);
  return response.data as T;
}

/** The real backend: the push_changes RPC and PostgREST selects (RLS limits rows to the user). */
export function supabaseBackend(client: SupabaseClient<Database>): SyncBackend {
  return {
    pushChanges: (changes) =>
      call(() => client.rpc('push_changes', { changes: changes as unknown as Json })).then((data) => (data ?? {}) as PushResult),
    pullChanges: (table, since, limit) =>
      call(() => client.from(table).select('*').gt('server_seq', since).order('server_seq').limit(limit)).then(
        (data) => (data ?? []) as unknown as ServerRow[],
      ),
  };
}
