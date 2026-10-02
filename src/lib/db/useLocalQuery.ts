import { useCallback, useEffect, useRef, useState } from 'react';

import { onTablesChanged, type ChangedTable } from './changes';
import { getDb } from './client';
import type { LocalDb } from './types';

/**
 * Runs a synchronous local query and re-runs it whenever one of `tables`
 * changes (or `deps` change). Screens read data only through this.
 */
export function useLocalQuery<T>(query: (db: LocalDb) => T, tables: readonly ChangedTable[], deps: unknown[] = []): T {
  const queryRef = useRef(query);
  queryRef.current = query;
  const run = useCallback(() => queryRef.current(getDb()), []);

  const [data, setData] = useState<T>(run);

  useEffect(() => {
    setData(run());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass deps explicitly
  }, deps);

  const tablesKey = tables.join(',');
  useEffect(
    () =>
      onTablesChanged((changed) => {
        if (tables.some((t) => changed.has(t))) setData(run());
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tablesKey stands in for tables
    [tablesKey, run],
  );

  return data;
}
