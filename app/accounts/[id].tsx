import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { IconBadge } from '@/components/IconBadge';
import { ACCOUNT_ICONS, ColorPicker, COLORS, IconPicker } from '@/components/pickers';
import { useUser } from '@/lib/auth/store';
import { getDb } from '@/lib/db/client';
import { createAccount, deleteAccount, getAccount, updateAccount } from '@/lib/db/repositories/accounts';
import { parseTaka, poishaToInput, ZERO } from '@/utils/money';

export default function AccountEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const isNew = id === 'new';
  const [existing] = useState(() => (isNew ? undefined : getAccount(getDb(), id)));

  const [name, setName] = useState(existing?.name ?? '');
  const [balanceText, setBalanceText] = useState(existing ? poishaToInput(existing.initialBalance) : '');
  const [icon, setIcon] = useState(existing?.icon ?? 'wallet');
  const [color, setColor] = useState(existing?.color ?? COLORS[6]!);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isNew && (!existing || existing.deletedAt)) {
    return <Text style={styles.missing}>This account no longer exists.</Text>;
  }

  const save = () => {
    const initialBalance = balanceText.trim() === '' ? ZERO : parseTaka(balanceText);
    if (initialBalance === null) {
      setError('Enter the starting balance in taka, e.g. 1500 or 1500.50');
      return;
    }
    try {
      const db = getDb();
      if (isNew) createAccount(db, user.id, { name, initialBalance, icon, color });
      else updateAccount(db, id, { name, initialBalance, icon, color });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = () => {
    setConfirmDelete(false);
    try {
      deleteAccount(getDb(), id);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: isNew ? 'New account' : 'Edit account' }} />
      <View style={styles.preview}>
        <IconBadge icon={icon} color={color} size={64} />
      </View>
      <TextInput label="Name" mode="outlined" value={name} onChangeText={setName} maxLength={40} />
      <TextInput
        label="Starting balance (৳)"
        mode="outlined"
        value={balanceText}
        onChangeText={setBalanceText}
        keyboardType="decimal-pad"
        placeholder="0"
      />
      <Text variant="titleSmall">Icon</Text>
      <IconPicker icons={ACCOUNT_ICONS} value={icon} color={color} onChange={setIcon} />
      <Text variant="titleSmall">Colour</Text>
      <ColorPicker value={color} onChange={setColor} />
      {error && <HelperText type="error">{error}</HelperText>}
      <Button mode="contained" onPress={save}>
        Save
      </Button>
      {!isNew && (
        <Button textColor="#C62828" onPress={() => setConfirmDelete(true)}>
          Delete account
        </Button>
      )}
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete account?"
        message="Past transactions keep this account's name. You won't be able to pick it for new ones."
        confirmLabel="Delete"
        onConfirm={remove}
        onDismiss={() => setConfirmDelete(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  preview: { alignItems: 'center', marginVertical: 8 },
  missing: { padding: 24, textAlign: 'center' },
});
