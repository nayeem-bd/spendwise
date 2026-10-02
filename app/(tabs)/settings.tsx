import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, Dialog, Divider, List, Portal, Text } from 'react-native-paper';

import { pendingChangeCount, signOut } from '@/lib/auth/auth';
import { useUser } from '@/lib/auth/store';

export default function SettingsScreen() {
  const user = useUser();
  const [confirm, setConfirm] = useState<{ pending: number } | null>(null);
  const [busy, setBusy] = useState(false);

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
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader>Account</List.Subheader>
        <List.Item title={user.email} description="Signed in" left={(props) => <List.Icon {...props} icon="account" />} />
        <List.Item
          title="Sign out"
          left={(props) => <List.Icon {...props} icon="logout" />}
          onPress={() => setConfirm({ pending: pendingChangeCount() })}
        />
      </List.Section>

      <Portal>
        <Dialog visible={confirm !== null} onDismiss={() => setConfirm(null)}>
          <Dialog.Title>Sign out?</Dialog.Title>
          <Dialog.Content>
            <Text>
              {confirm && confirm.pending > 0
                ? `${confirm.pending} change${confirm.pending === 1 ? " hasn't" : "s haven't"} synced yet and will be lost. Your synced data stays in your account.`
                : 'Data on this device will be removed. It stays in your account.'}
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
