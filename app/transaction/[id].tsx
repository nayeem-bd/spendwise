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
import type { Account } from '@/lib/db/schema';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { moneyColors } from '@/theme';
import { addDays, formatDay, todayISO } from '@/utils/date';
import { parseTaka, poishaToInput } from '@/utils/money';

type TxType = 'expense' | 'income' | 'transfer';

const TITLES: Record<TxType, string> = { expense: 'Add expense', income: 'Add income', transfer: 'Add transfer' };

export default function TransactionScreen() {
  const params = useLocalSearchParams<{ id: string; type?: TxType }>();
  const user = useUser();
  const theme = useTheme();
  const isNew = params.id === 'new';
  const [existing] = useState(() => (isNew ? undefined : getTransaction(getDb(), params.id)));

  const [type, setType] = useState<TxType>(existing?.type ?? params.type ?? 'expense');
  const [amountText, setAmountText] = useState(existing ? poishaToInput(existing.amount) : '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [accountId, setAccountId] = useState<string | null>(existing?.accountId ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(existing?.toAccountId ?? null);
  const [occurredOn, setOccurredOn] = useState(existing?.occurredOn ?? todayISO());
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const categoryType = type === 'income' ? 'income' : 'expense';
  const categories = useLocalQuery((db) => listCategories(db, categoryType), ['categories'], [categoryType]);
  const accounts = useLocalQuery(listAccounts, ['accounts']);
  // Default to Cash, else the first account.
  const selectedAccountId =
    accountId ?? accounts.find((a) => a.id === defaultRowId(user.id, 'account', 'cash'))?.id ?? accounts[0]?.id ?? null;
  // Transfers default to the first other account.
  const selectedToAccountId = toAccountId ?? accounts.find((a) => a.id !== selectedAccountId)?.id ?? null;

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
    const common = { amount, accountId: selectedAccountId ?? '', note, occurredOn };
    try {
      saveTransaction(
        getDb(),
        user.id,
        type === 'transfer'
          ? { ...common, type, toAccountId: selectedToAccountId ?? '' }
          : { ...common, type, categoryId: categoryId ?? '' },
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

  const color = type === 'transfer' ? theme.colors.onSurface : moneyColors(theme.dark)[type];

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isNew ? TITLES[type] : 'Edit transaction' }} />
      <SegmentedButtons
        value={type}
        onValueChange={(v) => changeType(v as TxType)}
        buttons={[
          { value: 'expense', label: 'Expense', icon: 'minus' },
          { value: 'income', label: 'Income', icon: 'plus' },
          ...(accounts.length > 1 ? [{ value: 'transfer', label: 'Transfer', icon: 'swap-horizontal' }] : []),
        ]}
      />

      <Text variant="displaySmall" style={[styles.amount, { color }]} accessibilityLabel="Amount">
        ৳{displayAmountText(amountText)}
      </Text>

      {type === 'transfer' ? (
        <>
          <Text variant="titleSmall">From</Text>
          <AccountChips accounts={accounts} value={selectedAccountId} onChange={setAccountId} />
          <Text variant="titleSmall">To</Text>
          <AccountChips accounts={accounts} value={selectedToAccountId} onChange={setToAccountId} disabledId={selectedAccountId} />
        </>
      ) : (
        <>
          <Text variant="titleSmall">Category</Text>
          <CategoryGrid categories={categories} value={categoryId} onChange={setCategoryId} />
          <Text variant="titleSmall">Account</Text>
          <AccountChips accounts={accounts} value={selectedAccountId} onChange={setAccountId} />
        </>
      )}

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

function AccountChips({
  accounts,
  value,
  onChange,
  disabledId,
}: {
  accounts: Account[];
  value: string | null;
  onChange: (id: string) => void;
  disabledId?: string | null;
}) {
  return (
    <View style={styles.chips}>
      {accounts.map((a) => (
        <Chip
          key={a.id}
          selected={a.id === value}
          showSelectedOverlay
          disabled={a.id === disabledId}
          onPress={() => onChange(a.id)}
        >
          {a.name}
        </Chip>
      ))}
    </View>
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
