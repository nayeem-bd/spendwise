import { router } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';

import { PullToRefresh } from '@/components/PullToRefresh';
import { AddButtons } from '@/components/AddButtons';
import { DonutChart } from '@/components/DonutChart';
import { IconBadge } from '@/components/IconBadge';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { MonthTotals, Total } from '@/components/MonthTotals';
import { page, useWindowClass } from '@/components/layout';
import { Section } from '@/components/Section';
import { TransactionRow } from '@/components/TransactionRow';
import { useSyncRefresh } from '@/components/useSyncRefresh';
import { EmptyState } from '@/components/EmptyState';
import { budgetStatuses } from '@/lib/db/repositories/budgets';
import { dailyExpense, expenseByCategory, monthTotals, spendingPace, type CategoryTotal } from '@/lib/db/repositories/summary';
import { listTransactions } from '@/lib/db/repositories/transactions';
import { useT } from '@/i18n/i18n';
import { useDisplayName } from '@/i18n/names';
import { useFormat } from '@/i18n/useFormat';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { useMonthStore } from '@/store/month';
import { moneyColors } from '@/theme';
import { daysLeftInMonth, todayISO } from '@/utils/date';
import type { Poisha } from '@/utils/money';

const FALLBACK_COLOR = '#9E9E9E';

// Desktop web: the overview and + / − stay in view while the category list scrolls.
// RN's types have no 'sticky', react-native-web passes it through to CSS.
const stickyOnWeb = Platform.OS === 'web' ? ({ position: 'sticky', top: 0 } as unknown as ViewStyle) : null;

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const { width, expanded } = useWindowClass();
  const colors = moneyColors(theme.dark);
  const month = useMonthStore((s) => s.month);
  const totals = useLocalQuery((db) => monthTotals(db, month), ['transactions'], [month]);
  const byCategory = useLocalQuery((db) => expenseByCategory(db, month), ['transactions', 'categories'], [month]);
  const recent = useLocalQuery((db) => listTransactions(db, { month, limit: 5 }), ['transactions', 'categories', 'accounts'], [month]);
  const { refreshing, onRefresh } = useSyncRefresh();
  // Fill small phones without overflowing; cap on tablets and desktop.
  const chartSize = expanded ? 280 : Math.max(180, Math.min(260, width - 120));

  const overview = (
    <>
      <MonthSwitcher onCard={expanded} />
      <View style={styles.chart}>
        <DonutChart
          size={chartSize}
          thickness={chartSize / 8}
          emptyColor={theme.colors.surfaceVariant}
          segments={byCategory.map((c) => ({ key: c.categoryId ?? 'none', value: c.total, color: c.color ?? FALLBACK_COLOR, icon: c.icon }))}
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
      <PaceRow month={month} onCard={expanded} />
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

  // Tap opens the details, swipe for Edit / Delete (same rows as the Transactions tab).
  const recentList = recent.length > 0 && (
    <Section
      title={t('home.recent')}
      action={
        <Button compact onPress={() => router.navigate('/transactions')}>
          {t('home.seeAll')}
        </Button>
      }
      separators
      style={expanded && styles.flush}
    >
      {recent.map((item) => (
        <TransactionRow key={item.id} item={item} showDate />
      ))}
    </Section>
  );

  const refresh = <PullToRefresh refreshing={refreshing} onRefresh={onRefresh} />;

  if (expanded) {
    // Desktop / large tablet: overview and the + / − buttons on the left, breakdown on the right.
    return (
      <ScrollView contentContainerStyle={[page.wide, styles.content]} refreshControl={refresh}>
        <View style={page.columns}>
          <View style={[page.column, stickyOnWeb]}>
            <Section title={t('home.overview')} style={styles.flush}>
              {overview}
              <AddButtons />
            </Section>
          </View>
          <View style={page.column}>
            {breakdown}
            {recentList}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[page.list, styles.content]} refreshControl={refresh}>
        {overview}
        {breakdown}
        {recentList}
      </ScrollView>
      <AddButtons />
    </View>
  );
}

/**
 * This month's pace: spent today, the average per day so far, and (with a
 * monthly budget) what can still be spent per day, like Money Lover and Copilot.
 */
function PaceRow({ month, onCard }: { month: string; onCard: boolean }) {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const colors = moneyColors(theme.dark);
  const today = todayISO();
  const pace = useLocalQuery((db) => spendingPace(dailyExpense(db, month), month, today), ['transactions'], [month, today]);
  const budget = useLocalQuery((db) => budgetStatuses(db, month).total, ['budgets', 'transactions'], [month]);
  if (!pace) return null;
  const tile = onCard ? theme.colors.elevation.level2 : theme.colors.elevation.level1;
  const left = budget ? budget.amount - budget.spent : 0;
  const days = daysLeftInMonth(month, today);
  return (
    <View style={styles.pace}>
      <Total label={t('home.today')} icon="calendar-today" value={f.money(pace.today)} color={theme.colors.onSurface} dense tile={tile} />
      <Total label={t('home.avgPerDay')} icon="chart-line-variant" value={f.money(pace.averagePerDay)} color={theme.colors.onSurface} dense tile={tile} />
      {budget && left > 0 && days > 0 && (
        <Total
          label={t('home.leftPerDay')}
          icon="piggy-bank-outline"
          value={f.money(Math.floor(left / days) as Poisha)}
          color={pace.averagePerDay > left / days ? colors.expense : colors.income}
          dense
          tile={tile}
        />
      )}
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
          <View style={styles.shareName}>
            <Text variant="bodyLarge" numberOfLines={1}>
              {name(item.categoryId, item.name) || t('common.uncategorized')}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {item.count === 1 ? t('home.count1') : t('home.count', { count: item.count })}
            </Text>
          </View>
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
  shareName: { flex: 1, minWidth: 0 },
  pace: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12, marginTop: -4 },
  shareAmount: { fontWeight: '600' },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  percent: { minWidth: 32, textAlign: 'right' },
});
