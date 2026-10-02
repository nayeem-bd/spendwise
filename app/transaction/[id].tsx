import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, HelperText, IconButton, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';

import { AmountKeypad } from '@/components/AmountKeypad';
import { CategoryGrid } from '@/components/CategoryGrid';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { applyKey, displayAmountText } from '@/components/keypad';
import { useUser } from '@/lib/auth/store';
import { getDb } from '@/lib/db/client';
import { defaultRowId } from '@/lib/db/defaults';
import { listAccounts } from '@/lib/db/repositories/accounts';
import { listCategories } from '@/lib/db/repositories/categories';
import { deleteTransaction, getTransaction, saveTransaction } from '@/lib/db/repositories/transactions';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { moneyColors } from '@/theme';
import { addDays, formatDay, todayISO } from '@/utils/date';
import { parseTaka, poishaToInput } from '@/utils/money';

type TxType = 'expense' | 'income';

export default function TransactionScreen() {
  const params = useLocalSearchParams<{ id: string; type?: TxType }>();
  const user = useUser();
  const theme = useTheme();
  const isNew = params.id === 'new';
  const [existing] = useState(() => (isNew ? undefined : getTransaction(getDb(), params.id)));

  const [type, setType] = useState<TxType>(
    existing?.type === 'income' || (!existing && params.type === 'income') ? 'income' : 'expense',
  );
  const [amountText, setAmountText] = useState(existing ? poishaToInput(existing.amount) : '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [accountId, setAccountId] = useState<string | null>(existing?.accountId ?? null);
  const [occurredOn, setOccurredOn] = useState(existing?.occurredOn ?? todayISO());
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categories = useLocalQuery((db) => listCategories(db, type), ['categories'], [type]);
  const accounts = useLocalQuery(listAccounts, ['accounts']);
  // Default to Cash, else the first account.
  const selectedAccountId =
    accountId ?? accounts.find((a) => a.id === defaultRowId(user.id, 'account', 'cash'))?.id ?? accounts[0]?.id ?? null;

  if (!isNew && (!existing || existing.deletedAt)) {
    return <Text style={styles.missing}>This transaction no longer exists.</Text>;
  }

  const changeType = (next: TxType) => {
    setType(next);
    setCategoryId(null); // categories are per type
  };

  const save = () => {
    const amount = parseTaka(amountText);
    if (amount === null || amount <= 0) {
      setError('Enter an amount above ৳0');
      return;
    }
    try {
      saveTransaction(
        getDb(),
        user.id,
        { type, amount, categoryId: categoryId ?? '', accountId: selectedAccountId ?? '', note, occurredOn },
        isNew ? undefined : params.id,
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = () => {
    deleteTransaction(getDb(), params.id);
    setConfirmDelete(false);
    router.back();
  };

  const color = moneyColors(theme.dark)[type];

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isNew ? (type === 'income' ? 'Add income' : 'Add expense') : 'Edit transaction' }} />
      <SegmentedButtons
        value={type}
        onValueChange={(v) => changeType(v as TxType)}
        buttons={[
          { value: 'expense', label: 'Expense', icon: 'minus' },
          { value: 'income', label: 'Income', icon: 'plus' },
        ]}
      />

      <Text variant="displaySmall" style={[styles.amount, { color }]} accessibilityLabel="Amount">
        ৳{displayAmountText(amountText)}
      </Text>

      <Text variant="titleSmall">Category</Text>
      <CategoryGrid categories={categories} value={categoryId} onChange={setCategoryId} />

      <Text variant="titleSmall">Account</Text>
      <View style={styles.chips}>
        {accounts.map((a) => (
          <Chip key={a.id} selected={a.id === selectedAccountId} showSelectedOverlay onPress={() => setAccountId(a.id)}>
            {a.name}
          </Chip>
        ))}
      </View>

      <View style={styles.dateRow}>
        <IconButton icon="chevron-left" accessibilityLabel="Previous day" onPress={() => setOccurredOn(addDays(occurredOn, -1))} />
        <Button icon="calendar" onPress={() => setOccurredOn(todayISO())}>
          {formatDay(occurredOn)}
        </Button>
        <IconButton icon="chevron-right" accessibilityLabel="Next day" onPress={() => setOccurredOn(addDays(occurredOn, 1))} />
      </View>

      <TextInput label="Note (optional)" mode="outlined" value={note} onChangeText={setNote} maxLength={200} />

      <AmountKeypad onKey={(key) => setAmountText((t) => applyKey(t, key))} />

      {error && <HelperText type="error">{error}</HelperText>}
      <Button mode="contained" onPress={save} contentStyle={styles.saveContent}>
        Save
      </Button>
      {!isNew && (
        <Button textColor="#C62828" onPress={() => setConfirmDelete(true)}>
          Delete transaction
        </Button>
      )}
      <ConfirmDialog
        visible={confirmDelete}
        title="Delete transaction?"
        message="This removes it from your history on all your devices."
        confirmLabel="Delete"
        onConfirm={remove}
        onDismiss={() => setConfirmDelete(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  amount: { textAlign: 'center', fontVariant: ['tabular-nums'], marginVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  saveContent: { height: 48 },
  missing: { padding: 24, textAlign: 'center' },
});
