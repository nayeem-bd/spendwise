import { Snackbar } from 'react-native-paper';

import { useT } from '@/i18n/i18n';
import { reloadForUpdate, usePwaStore } from '@/lib/pwa';

/** Web: offers a reload when a new version of the app has been installed. */
export function UpdateSnackbar() {
  const updateReady = usePwaStore((s) => s.updateReady);
  const { t } = useT();
  return (
    <Snackbar
      visible={updateReady}
      onDismiss={() => usePwaStore.setState({ updateReady: false })}
      duration={Number.MAX_SAFE_INTEGER}
      action={{ label: t('update.reload'), onPress: reloadForUpdate }}
    >
      {t('update.ready')}
    </Snackbar>
  );
}
