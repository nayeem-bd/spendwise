import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Dialog, Divider, List, Portal, SegmentedButtons, Text } from 'react-native-paper';

import { pendingChangeCount, signOut } from '@/lib/auth/auth';
import { useUser } from '@/lib/auth/store';
import { syncNow } from '@/lib/sync/syncEngine';
import { setThemePreference, useThemeStore, type ThemePreference } from '@/store/theme';

export default function SettingsScreen() {
  const user = useUser();
  const theme = useThemeStore((st) => st.preference);
  const [confirm, setConfirm] = useState<{ pending: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const askSignOut = async () => {
    setBusy(true);
    try {
      await syncNow(); // push what we can first, so less is lost
    } finally {
      setBusy(false);
      setConfirm({ pending: pendingChangeCount() });
    }
  };

  const doSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <ScrollView>
      <List.Section>
        <List.Subheader>Manage</List.Subheader>
        <List.Item
          title="Categories"
          left={(props) => <List.Icon {...props} icon="shape" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/categories')}
        />
        <List.Item
          title="Accounts"
          left={(props) => <List.Icon {...props} icon="wallet" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/accounts')}
        />
        <List.Item
          title="Repeating transactions"
          left={(props) => <List.Icon {...props} icon="repeat" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => router.push('/recurring')}
        />
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader>Appearance</List.Subheader>
        <SegmentedButtons
          style={styles.segment}
          value={theme}
          onValueChange={(v) => setThemePreference(v as ThemePreference)}
          buttons={[
            { value: 'system', label: 'System', icon: 'theme-light-dark' },
            { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
            { value: 'dark', label: 'Dark', icon: 'weather-night' },
          ]}
        />
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader>Account</List.Subheader>
        <List.Item title={user.email} description="Signed in" left={(props) => <List.Icon {...props} icon="account" />} />
        <List.Item
          title="Sign out"
          description={busy && !confirm ? 'Syncing first…' : undefined}
          left={(props) => <List.Icon {...props} icon="logout" />}
          onPress={askSignOut}
          disabled={busy}
        />
      </List.Section>

      <Portal>
        <Dialog visible={confirm !== null} onDismiss={() => setConfirm(null)}>
          <Dialog.Title>Sign out?</Dialog.Title>
          <Dialog.Content>
            <Text>
              {confirm && confirm.pending > 0
                ? `${confirm.pending} change${confirm.pending === 1 ? " hasn't" : "s haven't"} synced yet and will be lost. Your synced data stays in your account.`
                : 'Everything is synced. Data on this device will be removed; it stays in your account.'}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirm(null)}>Cancel</Button>
            <Button onPress={doSignOut} loading={busy} textColor={confirm?.pending ? '#C62828' : undefined}>
              Sign out
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  segment: { marginHorizontal: 16 },
});
