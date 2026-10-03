import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Divider, List, Surface, Text } from 'react-native-paper';

import { BudgetRow } from '@/components/BudgetRow';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { page, useWindowClass } from '@/components/layout';
import { useSyncRefresh } from '@/components/useSyncRefresh';
import { budgetStatuses } from '@/lib/db/repositories/budgets';
import { useT } from '@/i18n/i18n';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { useMonthStore } from '@/store/month';

const edit = (month: string, category: string) => router.push({ pathname: '/budget/edit', params: { month, category } });

export default function BudgetsScreen() {
  const month = useMonthStore((s) => s.month);
  const { t } = useT();
  const { total, categories } = useLocalQuery(
    (db) => budgetStatuses(db, month),
    ['budgets', 'transactions', 'categories'],
    [month],
  );
  const { refreshing, onRefresh } = useSyncRefresh();
  const { expanded } = useWindowClass();

  const monthly = (
    <>
      <List.Subheader>{t('budget.wholeMonth')}</List.Subheader>
      {total ? (
        <BudgetRow status={total} onPress={() => edit(month, 'total')} />
      ) : (
        <View style={styles.empty}>
          <Text>{t('budget.wholeMonthHint')}</Text>
          <Button mode="outlined" icon="plus" onPress={() => edit(month, 'total')}>
            {t('budget.setMonthly')}
          </Button>
        </View>
      )}
    </>
  );

  const perCategory = (
    <>
      <List.Subheader>{t('settings.categories')}</List.Subheader>
      {categories.length === 0 && <Text style={styles.hint}>{t('budget.noneYet')}</Text>}
      {categories.map((c) => (
        <BudgetRow key={c.categoryId} status={c} onPress={() => edit(month, c.categoryId!)} />
      ))}
      <Button icon="plus" style={styles.add} onPress={() => edit(month, 'new')}>
        {t('budget.addCategory')}
      </Button>
    </>
  );

  return (
    <ScrollView
      contentContainerStyle={[expanded ? page.wide : page.list, styles.content]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <MonthSwitcher />
      {expanded ? (
        <View style={page.columns}>
          <Surface style={[page.column, styles.card]} elevation={1}>
            {monthly}
          </Surface>
          <Surface style={[page.column, styles.card]} elevation={1}>
            {perCategory}
          </Surface>
        </View>
      ) : (
        <>
          {monthly}
          <Divider style={styles.divider} />
          {perCategory}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  card: { borderRadius: 16, paddingBottom: 12, overflow: 'hidden' },
  empty: { paddingHorizontal: 16, paddingBottom: 8, gap: 12, alignItems: 'flex-start' },
  hint: { paddingHorizontal: 16 },
  divider: { marginTop: 16 },
  add: { alignSelf: 'flex-start', marginHorizontal: 8, marginTop: 8 },
});
