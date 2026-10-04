import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { PullToRefresh } from '@/components/PullToRefresh';
import { AddButtons } from '@/components/AddButtons';
import { DonutChart } from '@/components/DonutChart';
import { IconBadge } from '@/components/IconBadge';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { MonthTotals } from '@/components/MonthTotals';
import { page, useWindowClass } from '@/components/layout';
import { Section } from '@/components/Section';
import { useSyncRefresh } from '@/components/useSyncRefresh';
import { EmptyState } from '@/components/EmptyState';
import { expenseByCategory, monthTotals, type CategoryTotal } from '@/lib/db/repositories/summary';
import { useT } from '@/i18n/i18n';
import { useDisplayName } from '@/i18n/names';
import { useFormat } from '@/i18n/useFormat';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { useMonthStore } from '@/store/month';
import { moneyColors } from '@/theme';

const FALLBACK_COLOR = '#9E9E9E';

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const { width, expanded } = useWindowClass();
  const colors = moneyColors(theme.dark);
  const month = useMonthStore((s) => s.month);
  const totals = useLocalQuery((db) => monthTotals(db, month), ['transactions'], [month]);
  const byCategory = useLocalQuery((db) => expenseByCategory(db, month), ['transactions', 'categories'], [month]);
  const { refreshing, onRefresh } = useSyncRefresh();
  // Fill small phones without overflowing; cap on tablets and desktop.
  const chartSize = expanded ? 280 : Math.max(180, Math.min(260, width - 120));

  const overview = (
    <>
      <MonthSwitcher />
      <View style={styles.chart}>
        <DonutChart
          size={chartSize}
          thickness={chartSize / 8}
          emptyColor={theme.colors.surfaceVariant}
          segments={byCategory.map((c) => ({ key: c.categoryId ?? 'none', value: c.total, color: c.color ?? FALLBACK_COLOR }))}
        >
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('home.spent')}
          </Text>
          <Text
            variant="headlineSmall"
            style={[styles.number, styles.centerAmount, { color: colors.expense }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={`${t('home.spent')} ${f.money(totals.expense)}`}
          >
            {f.money(totals.expense)}
          </Text>
        </DonutChart>
      </View>
      <MonthTotals totals={totals} onCard={expanded} />
    </>
  );

  const breakdown = (
    <Section title={t('home.byCategory')} style={expanded && styles.flush}>
      {byCategory.length === 0 ? (
        <EmptyState icon="chart-donut" text={t('home.empty')} />
      ) : (
        byCategory.map((c) => <CategoryShare key={c.categoryId ?? 'none'} item={c} total={totals.expense} />)
      )}
    </Section>
  );

  const refresh = <PullToRefresh refreshing={refreshing} onRefresh={onRefresh} />;

  if (expanded) {
    // Desktop / large tablet: overview and the + / − buttons on the left, breakdown on the right.
    return (
      <ScrollView contentContainerStyle={[page.wide, styles.content]} refreshControl={refresh}>
        <View style={page.columns}>
          <View style={page.column}>
            <Section title={t('home.overview')} style={styles.flush}>
              {overview}
              <AddButtons />
            </Section>
          </View>
          <View style={page.column}>{breakdown}</View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[page.list, styles.content]} refreshControl={refresh}>
        {overview}
        {breakdown}
      </ScrollView>
      <AddButtons />
    </View>
  );
}

/** A category's spending with a bar showing its share of the month. */
function CategoryShare({ item, total }: { item: CategoryTotal; total: number }) {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const name = useDisplayName();
  const share = total > 0 ? item.total / total : 0;
  const color = item.color ?? FALLBACK_COLOR;
  return (
    <View style={styles.share}>
      <IconBadge icon={item.icon} color={color} size={36} />
      <View style={styles.shareBody}>
        <View style={styles.shareLine}>
          <Text variant="bodyLarge" numberOfLines={1} style={styles.shareName}>
            {name(item.categoryId, item.name) || t('common.uncategorized')}
          </Text>
          <Text variant="bodyLarge" style={[styles.number, styles.shareAmount]}>
            {f.money(item.total)}
          </Text>
        </View>
        <View style={styles.shareLine}>
          <View style={[styles.track, { backgroundColor: theme.colors.surfaceVariant }]}>
            <View style={[styles.fill, { width: `${Math.max(share * 100, 1)}%`, backgroundColor: color }]} />
          </View>
          <Text variant="labelSmall" style={[styles.number, styles.percent, { color: theme.colors.onSurfaceVariant }]}>
            {f.num(Math.round(share * 100))}%
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 16, paddingTop: 8 },
  flush: { marginHorizontal: 0 },
  chart: { alignItems: 'center', marginVertical: 8 },
  centerAmount: { maxWidth: '70%' },
  number: { fontVariant: ['tabular-nums'] },
  share: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  shareBody: { flex: 1, minWidth: 0, gap: 6 },
  shareLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareName: { flex: 1 },
  shareAmount: { fontWeight: '600' },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  percent: { minWidth: 32, textAlign: 'right' },
});
