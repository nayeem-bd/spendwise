import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Divider, List, Text, useTheme } from 'react-native-paper';

import { IconBadge } from '@/components/IconBadge';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { TrendChart } from '@/components/TrendChart';
import { useSyncRefresh } from '@/components/useSyncRefresh';
import { categoryComparison, monthlyTrend } from '@/lib/db/repositories/summary';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { useMonthStore } from '@/store/month';
import { moneyColors } from '@/theme';
import { addMonths, formatMonth } from '@/utils/date';
import { formatBDT, type Poisha } from '@/utils/money';

export default function ReportsScreen() {
  const theme = useTheme();
  const colors = moneyColors(theme.dark);
  const month = useMonthStore((s) => s.month);
  const trend = useLocalQuery((db) => monthlyTrend(db, month, 6), ['transactions'], [month]);
  const comparison = useLocalQuery((db) => categoryComparison(db, month), ['transactions', 'categories'], [month]);
  const { refreshing, onRefresh } = useSyncRefresh();
  const previous = formatMonth(addMonths(month, -1));

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <MonthSwitcher />
      <List.Subheader>Last 6 months</List.Subheader>
      <View style={styles.chart}>
        <TrendChart data={trend} selected={month} />
      </View>

      <Divider style={styles.divider} />
      <List.Subheader>Spending vs {previous}</List.Subheader>
      {comparison.length === 0 && <Text style={styles.empty}>No spending in either month.</Text>}
      {comparison.map((c) => {
        const up = c.change > 0;
        const pct = c.previous > 0 ? Math.round((Math.abs(c.change) / c.previous) * 100) : null;
        return (
          <List.Item
            key={c.categoryId ?? 'none'}
            title={c.name}
            description={`${formatBDT(c.total)} · was ${formatBDT(c.previous)}`}
            left={() => (
              <View style={styles.icon}>
                <IconBadge icon={c.icon} color={c.color} size={36} />
              </View>
            )}
            right={() => (
              <Text
                style={[styles.change, { color: c.change === 0 ? theme.colors.onSurfaceVariant : up ? colors.expense : colors.income }]}
                accessibilityLabel={c.change === 0 ? 'No change' : `${up ? 'Up' : 'Down'} ${formatBDT(Math.abs(c.change) as Poisha)}`}
              >
                {c.change === 0 ? '—' : `${up ? '▲' : '▼'} ${formatBDT(Math.abs(c.change) as Poisha)}${pct !== null ? ` (${pct}%)` : ''}`}
              </Text>
            )}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, maxWidth: 640, width: '100%', alignSelf: 'center' },
  chart: { paddingHorizontal: 16 },
  divider: { marginTop: 16 },
  empty: { paddingHorizontal: 16 },
  icon: { marginLeft: 16, justifyContent: 'center' },
  change: { alignSelf: 'center', fontVariant: ['tabular-nums'], fontWeight: '600' },
});
