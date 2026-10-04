import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { IconBadge } from '@/components/IconBadge';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { page, useWindowClass } from '@/components/layout';
import { Section } from '@/components/Section';
import { TrendChart } from '@/components/TrendChart';
import { useSyncRefresh } from '@/components/useSyncRefresh';
import { EmptyState } from '@/components/EmptyState';
import { categoryComparison, monthlyTrend } from '@/lib/db/repositories/summary';
import { useT } from '@/i18n/i18n';
import { useDisplayName } from '@/i18n/names';
import { useFormat } from '@/i18n/useFormat';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { useMonthStore } from '@/store/month';
import { moneyColors } from '@/theme';
import { addMonths } from '@/utils/date';
import type { Poisha } from '@/utils/money';

export default function ReportsScreen() {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const name = useDisplayName();
  const colors = moneyColors(theme.dark);
  const month = useMonthStore((s) => s.month);
  const trend = useLocalQuery((db) => monthlyTrend(db, month, 6), ['transactions'], [month]);
  const comparison = useLocalQuery((db) => categoryComparison(db, month), ['transactions', 'categories'], [month]);
  const { refreshing, onRefresh } = useSyncRefresh();
  const previous = f.month(addMonths(month, -1));
  const { expanded } = useWindowClass();

  const trendSection = (
    <Section title={t('reports.last6')} style={expanded && styles.flush}>
      <View style={styles.chart}>
        <TrendChart data={trend} selected={month} />
      </View>
    </Section>
  );

  const comparisonSection = (
    <Section title={t('reports.vs', { month: previous })} style={expanded && styles.flush} separators inset={64}>
      {comparison.length === 0 && <EmptyState icon="chart-bar" text={t('reports.empty')} />}
      {comparison.map((c) => {
        const up = c.change > 0;
        const pct = c.previous > 0 ? Math.round((Math.abs(c.change) / c.previous) * 100) : null;
        return (
          <View key={c.categoryId ?? 'none'} style={styles.row}>
            <IconBadge icon={c.icon} color={c.color} size={36} />
            <View style={styles.rowBody}>
              <Text variant="bodyLarge" numberOfLines={1}>
                {name(c.categoryId, c.name) || t('common.uncategorized')}
              </Text>
              <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
                {t('reports.was', { before: f.money(c.previous) })}
              </Text>
            </View>
            <View style={styles.rowEnd}>
              <Text variant="bodyLarge" style={[styles.number, styles.total]}>
                {f.money(c.total)}
              </Text>
              <Text
                variant="labelMedium"
                style={[styles.number, { color: c.change === 0 ? theme.colors.onSurfaceVariant : up ? colors.expense : colors.income }]}
                accessibilityLabel={c.change === 0 ? t('reports.noChange') : t(up ? 'reports.up' : 'reports.down', { amount: f.money(Math.abs(c.change) as Poisha) })}
              >
                {c.change === 0 ? '—' : `${up ? '▲' : '▼'} ${f.money(Math.abs(c.change) as Poisha)}${pct !== null ? ` · ${f.num(pct)}%` : ''}`}
              </Text>
            </View>
          </View>
        );
      })}
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
          <View style={page.column}>{trendSection}</View>
          <View style={page.column}>{comparisonSection}</View>
        </View>
      ) : (
        <>
          {trendSection}
          {comparisonSection}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  flush: { marginHorizontal: 0 },
  chart: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowEnd: { alignItems: 'flex-end', gap: 2 },
  number: { fontVariant: ['tabular-nums'] },
  total: { fontWeight: '600' },
});
