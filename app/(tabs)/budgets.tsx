import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

import { BudgetRow } from '@/components/BudgetRow';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { page, useWindowClass } from '@/components/layout';
import { Section } from '@/components/Section';
import { useSyncRefresh } from '@/components/useSyncRefresh';
import { EmptyState } from '@/components/EmptyState';
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
    <Section title={t('budget.wholeMonth')} style={expanded && styles.flush}>
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
    </Section>
  );

  const addButton = (
    <Button key="add" icon="plus" style={styles.add} onPress={() => edit(month, 'new')}>
      {t('budget.addCategory')}
    </Button>
  );

  const perCategory = (
    <Section title={t('settings.categories')} style={expanded && styles.flush} separators inset={64}>
      {categories.length === 0 ? (
        // One block, so no separator between the message and the button.
        <View>
          <EmptyState icon="target" text={t('budget.noneYet')} />
          {addButton}
        </View>
      ) : (
        [...categories.map((c) => <BudgetRow key={c.categoryId} status={c} onPress={() => edit(month, c.categoryId!)} />), addButton]
      )}
    </Section>
  );

  return (
    <ScrollView
      contentContainerStyle={[expanded ? page.wide : page.list, styles.content]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <MonthSwitcher />
      {expanded ? (
        <View style={page.columns}>
          <View style={page.column}>{monthly}</View>
          <View style={page.column}>{perCategory}</View>
        </View>
      ) : (
        <>
          {monthly}
          {perCategory}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  flush: { marginHorizontal: 0 },
  empty: { padding: 16, gap: 12, alignItems: 'flex-start' },
  add: { alignSelf: 'flex-start', margin: 8 },
});
