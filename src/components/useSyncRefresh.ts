import { useCallback, useState } from 'react';

import { syncNow } from '@/lib/sync/syncEngine';

/** Pull-to-refresh state that runs a sync. */
export function useSyncRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void syncNow().finally(() => setRefreshing(false));
  }, []);
  return { refreshing, onRefresh };
}
