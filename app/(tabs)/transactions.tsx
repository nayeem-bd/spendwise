import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { AddButtons } from '@/components/AddButtons';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { TransactionRow } from '@/components/TransactionRow';
import { useSyncRefresh } from '@/components/useSyncRefresh';
import { groupByDay, listTransactions } from '@/lib/db/repositories/transactions';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { useMonthStore } from '@/store/month';
import { moneyColors } from '@/theme';
import { formatDay } from '@/utils/date';
import { formatBDT } from '@/utils/money';

export default function TransactionsScreen() {
  const theme = useTheme();
  const colors = moneyColors(theme.dark);
  const month = useMonthStore((s) => s.month);
  const sections = useLocalQuery(
    (db) => groupByDay(listTransactions(db, { month })),
    ['transactions', 'categories', 'accounts'],
    [month],
  );
  const { refreshing, onRefresh } = useSyncRefresh();

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={<MonthSwitcher />}
        ListEmptyComponent={<Text style={styles.empty}>No transactions this month. Add one below.</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <View style={[styles.header, { backgroundColor: theme.colors.background }]}>
            <Text variant="labelLarge">{formatDay(section.day)}</Text>
            <Text variant="labelLarge" style={[styles.number, { color: section.net < 0 ? colors.expense : colors.income }]}>
              {section.net > 0 ? '+' : ''}
              {formatBDT(section.net)}
            </Text>
          </View>
        )}
        renderItem={({ item }) => <TransactionRow item={item} />}
        contentContainerStyle={styles.list}
      />
      <AddButtons />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  number: { fontVariant: ['tabular-nums'] },
  empty: { padding: 32, textAlign: 'center' },
});
