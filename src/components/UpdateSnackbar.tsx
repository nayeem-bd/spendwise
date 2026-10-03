import { Snackbar } from 'react-native-paper';

import { reloadForUpdate, usePwaStore } from '@/lib/pwa';

/** Web: offers a reload when a new version of the app has been installed. */
export function UpdateSnackbar() {
  const updateReady = usePwaStore((s) => s.updateReady);
  return (
    <Snackbar
      visible={updateReady}
      onDismiss={() => usePwaStore.setState({ updateReady: false })}
      duration={Number.MAX_SAFE_INTEGER}
      action={{ label: 'Reload', onPress: reloadForUpdate }}
    >
      A new version of SpendWise is ready.
    </Snackbar>
  );
}
