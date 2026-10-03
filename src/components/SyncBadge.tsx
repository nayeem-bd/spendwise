import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text, TextInput, useTheme } from 'react-native-paper';

import { translateError, translate, useT, type StringKey } from '@/i18n/i18n';
import { useFormat } from '@/i18n/useFormat';
import { reauthenticate } from '@/lib/auth/auth';
import { useSyncStore, type SyncStatus } from '@/lib/sync/store';
import { syncNow } from '@/lib/sync/syncEngine';

import type { IconName } from './IconBadge';
import { useWindowClass } from './layout';

function describe(status: SyncStatus, pending: number): { icon: IconName; label: string; warn: boolean } {
  const n = { count: pending };
  const pendingLabel = (withPending: StringKey, without: StringKey) => translate(pending ? withPending : without, n);
  switch (status) {
    case 'syncing':
      return { icon: 'sync', label: translate('sync.syncing'), warn: false };
    case 'offline':
      return { icon: 'cloud-off-outline', label: pendingLabel(pending === 1 ? 'sync.offlinePendingOne' : 'sync.offlinePending', 'sync.offline'), warn: true };
    case 'error':
      return { icon: 'alert-circle-outline', label: pendingLabel(pending === 1 ? 'sync.failedPendingOne' : 'sync.failedPending', 'sync.failed'), warn: true };
    case 'needsLogin':
      return { icon: 'account-alert-outline', label: translate('sync.needsLogin'), warn: true };
    case 'idle':
      return pending
        ? { icon: 'cloud-upload-outline', label: translate(pending === 1 ? 'sync.pendingOne' : 'sync.pending', n), warn: false }
        : { icon: 'check-circle-outline', label: translate('sync.synced'), warn: false };
  }
}

/** ✓ synced / ⟳ syncing / ⚠ offline with pending count. Tap to sync now. */
export function SyncBadge() {
  const { status, pending, error } = useSyncStore();
  const theme = useTheme();
  const [reauthOpen, setReauthOpen] = useState(false);
  const { t, lang } = useT();
  void lang; // re-render on language change
  const { icon, label, warn } = describe(status, pending);
  const color = warn ? theme.colors.error : theme.colors.onSurfaceVariant;
  // Narrow phones: keep the header title readable; the full label stays in accessibilityLabel.
  const short = useWindowClass().width < 400;
  const f = useFormat();

  return (
    <>
      <Pressable
        onPress={() => (status === 'needsLogin' ? setReauthOpen(true) : void syncNow())}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${status === 'needsLogin' ? t('auth.login') : t('sync.syncNow')}`}
        accessibilityHint={error ?? undefined}
        style={styles.badge}
      >
        <MaterialCommunityIcons name={icon} size={18} color={color} />
        {short ? (
          pending > 0 && (
            <Text variant="labelMedium" style={{ color }}>
              {f.num(pending)}
            </Text>
          )
        ) : (
          <Text variant="labelMedium" style={{ color }} numberOfLines={1}>
            {label}
          </Text>
        )}
      </Pressable>
      <ReauthDialog visible={reauthOpen} onDismiss={() => setReauthOpen(false)} />
    </>
  );
}

function ReauthDialog({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const { t } = useT();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await reauthenticate(password);
      setPassword('');
      onDismiss();
      void syncNow();
    } catch (e) {
      setError(translateError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{t('sync.needsLogin')}</Dialog.Title>
        <Dialog.Content style={styles.dialog}>
          <Text>{t('sync.reauthMessage')}</Text>
          <TextInput label={t('auth.password')} mode="outlined" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
          {error && <HelperText type="error">{error}</HelperText>}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>{t('common.cancel')}</Button>
          <Button onPress={submit} loading={busy} disabled={busy || !password}>
            {t('auth.login')}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6 },
  dialog: { gap: 12 },
});
