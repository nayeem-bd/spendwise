import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { CategoryGrid } from '@/components/CategoryGrid';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useUser } from '@/lib/auth/store';
import { getDb } from '@/lib/db/client';
import { budgetStatuses, getBudget, removeBudget, setBudget } from '@/lib/db/repositories/budgets';
import { getCategory, listCategories } from '@/lib/db/repositories/categories';
import { translate, translateError, useT } from '@/i18n/i18n';
import { useDisplayName } from '@/i18n/names';
import { useFormat } from '@/i18n/useFormat';
import { parseTaka, poishaToInput } from '@/utils/money';
import { goBack } from '@/lib/nav';

/** params.category: 'total' (whole month), 'new' (pick a category) or a category id. */
export default function BudgetEditScreen() {
  const params = useLocalSearchParams<{ month: string; category: string }>();
  const user = useUser();
  const { t } = useT();
  const f = useFormat();
  const name = useDisplayName();
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
    return listCategories(getDb(), 'expense', user.id).filter((c) => !taken.has(c.id));
  });

  const title =
    params.category === 'total'
      ? t('budget.monthly')
      : isNew
        ? t('budget.newCategory')
        : t('budget.categoryTitle', { name: name(params.category, getCategory(getDb(), params.category)?.name) || t('transaction.category') });

  const save = () => {
    const amount = parseTaka(amountText);
    if (amount === null || amount <= 0) {
      setError(translate('error.Enter a budget above ৳0'));
      return;
    }
    if (isNew && !categoryId) {
      setError(translate('error.Pick a category'));
      return;
    }
    try {
      setBudget(getDb(), user.id, { categoryId, month, amount });
      goBack();
    } catch (e) {
      setError(translateError(e));
    }
  };

  const remove = () => {
    removeBudget(getDb(), user.id, categoryId, month);
    setConfirmRemove(false);
    goBack();
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title }} />
      <Text variant="bodyMedium">
        {t('budget.fromOnwards', { month: f.month(month) })}
      </Text>
      {isNew &&
        (available.length ? (
          <>
            <Text variant="titleSmall">{t('transaction.category')}</Text>
            <CategoryGrid categories={available} value={categoryId} onChange={setCategoryId} />
          </>
        ) : (
          <Text>{t('budget.allTaken')}</Text>
        ))}
      <TextInput
        label={t('budget.amount')}
        mode="outlined"
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        placeholder={t('budget.placeholder')}
        autoFocus={!isNew}
      />
      {error && <HelperText type="error">{error}</HelperText>}
      <Button mode="contained" onPress={save}>
        {t('common.save')}
      </Button>
      {existing && (
        <Button textColor="#C62828" onPress={() => setConfirmRemove(true)}>
          {t('budget.remove')}
        </Button>
      )}
      <ConfirmDialog
        visible={confirmRemove}
        title={t('budget.removeTitle')}
        message={t('budget.removeMessage', { month: f.month(month) })}
        confirmLabel={t('budget.removeConfirm')}
        onConfirm={remove}
        onDismiss={() => setConfirmRemove(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
});
