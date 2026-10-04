import { useCallback, useState } from 'react';

import { syncNow } from '@/lib/sync/syncEngine';

// Keep the spinner up briefly even when the sync is instant (offline, nothing
// to send), so the pull visibly did something.
const MIN_SPIN_MS = 600;

/** Pull-to-refresh state that runs a sync. */
export function useSyncRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    const minimum = new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS));
    void Promise.allSettled([syncNow(), minimum]).then(() => setRefreshing(false));
  }, []);
  return { refreshing, onRefresh };
}
