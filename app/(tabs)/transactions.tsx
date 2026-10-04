import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { AddButtons } from '@/components/AddButtons';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { MonthTotals } from '@/components/MonthTotals';
import { page } from '@/components/layout';
import { TransactionRow } from '@/components/TransactionRow';
import { useSyncRefresh } from '@/components/useSyncRefresh';
import { EmptyState } from '@/components/EmptyState';
import { monthTotals } from '@/lib/db/repositories/summary';
import { groupByDay, listTransactions } from '@/lib/db/repositories/transactions';
import { useT } from '@/i18n/i18n';
import { useFormat } from '@/i18n/useFormat';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { useMonthStore } from '@/store/month';
import { moneyColors } from '@/theme';

export default function TransactionsScreen() {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const colors = moneyColors(theme.dark);
  const month = useMonthStore((s) => s.month);
  const sections = useLocalQuery(
    (db) => groupByDay(listTransactions(db, { month })),
    ['transactions', 'categories', 'accounts'],
    [month],
  );
  const totals = useLocalQuery((db) => monthTotals(db, month), ['transactions'], [month]);
  const { refreshing, onRefresh } = useSyncRefresh();

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={
          <>
            <MonthSwitcher />
            {sections.length > 0 && <MonthTotals totals={totals} dense />}
          </>
        }
        ListEmptyComponent={<EmptyState icon="receipt-text-outline" text={t('transactions.empty')} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
            <Text variant="labelLarge">{f.day(section.day)}</Text>
            <Text variant="labelLarge" style={[styles.number, { color: section.net < 0 ? colors.expense : colors.income }]}>
              {section.net > 0 ? '+' : ''}
              {f.money(section.net)}
            </Text>
          </View>
        )}
        renderItem={({ item }) => <TransactionRow item={item} />}
        contentContainerStyle={[page.list, styles.list]}
      />
      <AddButtons />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  number: { fontVariant: ['tabular-nums'] },
});
