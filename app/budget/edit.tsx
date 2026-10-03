import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { CategoryGrid } from '@/components/CategoryGrid';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useUser } from '@/lib/auth/store';
import { getDb } from '@/lib/db/client';
import { budgetStatuses, getBudget, removeBudget, setBudget } from '@/lib/db/repositories/budgets';
import { getCategory, listCategories } from '@/lib/db/repositories/categories';
import { formatMonth } from '@/utils/date';
import { parseTaka, poishaToInput } from '@/utils/money';

/** params.category: 'total' (whole month), 'new' (pick a category) or a category id. */
export default function BudgetEditScreen() {
  const params = useLocalSearchParams<{ month: string; category: string }>();
  const user = useUser();
  const month = params.month;
  const isNew = params.category === 'new';

  const [categoryId, setCategoryId] = useState<string | null>(
    params.category === 'total' || isNew ? null : params.category,
  );
  const [existing] = useState(() => (isNew ? undefined : getBudget(getDb(), categoryId, month)));
  const [amountText, setAmountText] = useState(existing ? poishaToInput(existing.amount) : '');
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Expense categories that don't have a budget yet this month.
  const [available] = useState(() => {
    if (!isNew) return [];
    const taken = new Set(budgetStatuses(getDb(), month).categories.map((c) => c.categoryId));
    return listCategories(getDb(), 'expense').filter((c) => !taken.has(c.id));
  });

  const title =
    params.category === 'total' ? 'Monthly budget' : isNew ? 'New category budget' : `${getCategory(getDb(), params.category)?.name ?? 'Category'} budget`;

  const save = () => {
    const amount = parseTaka(amountText);
    if (amount === null || amount <= 0) {
      setError('Enter a budget above ৳0');
      return;
    }
    if (isNew && !categoryId) {
      setError('Pick a category');
      return;
    }
    try {
      setBudget(getDb(), user.id, { categoryId, month, amount });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = () => {
    removeBudget(getDb(), user.id, categoryId, month);
    setConfirmRemove(false);
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title }} />
      <Text variant="bodyMedium">
        From {formatMonth(month)} onwards. Later months keep this budget until you change it.
      </Text>
      {isNew &&
        (available.length ? (
          <>
            <Text variant="titleSmall">Category</Text>
            <CategoryGrid categories={available} value={categoryId} onChange={setCategoryId} />
          </>
        ) : (
          <Text>Every expense category already has a budget this month.</Text>
        ))}
      <TextInput
        label="Budget (৳)"
        mode="outlined"
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        placeholder="e.g. 15000"
        autoFocus={!isNew}
      />
      {error && <HelperText type="error">{error}</HelperText>}
      <Button mode="contained" onPress={save}>
        Save
      </Button>
      {existing && (
        <Button textColor="#C62828" onPress={() => setConfirmRemove(true)}>
          Remove budget
        </Button>
      )}
      <ConfirmDialog
        visible={confirmRemove}
        title="Remove budget?"
        message={`No budget from ${formatMonth(month)} onwards. Earlier months keep theirs.`}
        confirmLabel="Remove"
        onConfirm={remove}
        onDismiss={() => setConfirmRemove(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
});
