import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Button, Dialog, HelperText, Portal, Text, TextInput, useTheme } from 'react-native-paper';

import { reauthenticate } from '@/lib/auth/auth';
import { useSyncStore, type SyncStatus } from '@/lib/sync/store';
import { syncNow } from '@/lib/sync/syncEngine';

import type { IconName } from './IconBadge';

function describe(status: SyncStatus, pending: number): { icon: IconName; label: string; warn: boolean } {
  const changes = `${pending} change${pending === 1 ? '' : 's'}`;
  switch (status) {
    case 'syncing':
      return { icon: 'sync', label: 'Syncing…', warn: false };
    case 'offline':
      return { icon: 'cloud-off-outline', label: pending ? `Offline · ${changes} pending` : 'Offline', warn: true };
    case 'error':
      return { icon: 'alert-circle-outline', label: pending ? `Sync failed · ${changes} pending` : 'Sync failed', warn: true };
    case 'needsLogin':
      return { icon: 'account-alert-outline', label: 'Log in to sync', warn: true };
    case 'idle':
      return pending
        ? { icon: 'cloud-upload-outline', label: `${changes} pending`, warn: false }
        : { icon: 'check-circle-outline', label: 'Synced', warn: false };
  }
}

/** ✓ synced / ⟳ syncing / ⚠ offline with pending count. Tap to sync now. */
export function SyncBadge() {
  const { status, pending, error } = useSyncStore();
  const theme = useTheme();
  const [reauthOpen, setReauthOpen] = useState(false);
  const { icon, label, warn } = describe(status, pending);
  const color = warn ? theme.colors.error : theme.colors.onSurfaceVariant;

  return (
    <>
      <Pressable
        onPress={() => (status === 'needsLogin' ? setReauthOpen(true) : void syncNow())}
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${status === 'needsLogin' ? 'Log in' : 'Sync now'}`}
        accessibilityHint={error ?? undefined}
        style={styles.badge}
      >
        <MaterialCommunityIcons name={icon} size={18} color={color} />
        <Text variant="labelMedium" style={{ color }}>
          {label}
        </Text>
      </Pressable>
      <ReauthDialog visible={reauthOpen} onDismiss={() => setReauthOpen(false)} />
    </>
  );
}

function ReauthDialog({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
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
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Log in to sync</Dialog.Title>
        <Dialog.Content style={styles.dialog}>
          <Text>Your login expired. Enter your password to sync again. Nothing on this device is lost.</Text>
          <TextInput label="Password" mode="outlined" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={submit} />
          {error && <HelperText type="error">{error}</HelperText>}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={submit} loading={busy} disabled={busy || !password}>
            Log in
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
