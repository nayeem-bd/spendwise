import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { List, Surface, Text, useTheme } from 'react-native-paper';

import { AddButtons } from '@/components/AddButtons';
import { DonutChart } from '@/components/DonutChart';
import { IconBadge } from '@/components/IconBadge';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { page, useWindowClass } from '@/components/layout';
import { useSyncRefresh } from '@/components/useSyncRefresh';
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
      <View style={styles.totals}>
        <Total label={t('type.income')} icon="arrow-down" value={f.money(totals.income)} color={colors.income} />
        <Total label={t('type.expense')} icon="arrow-up" value={f.money(totals.expense)} color={colors.expense} />
        <Total label={t('home.balance')} icon="scale-balance" value={f.money(totals.balance)} color={totals.balance < 0 ? colors.expense : theme.colors.onSurface} />
      </View>
    </>
  );

  const breakdown = (
    <>
      <List.Subheader>{t('home.byCategory')}</List.Subheader>
      {byCategory.length === 0 ? (
        <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>{t('home.empty')}</Text>
      ) : (
        byCategory.map((c) => <CategoryShare key={c.categoryId ?? 'none'} item={c} total={totals.expense} />)
      )}
    </>
  );

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />;

  if (expanded) {
    // Desktop / large tablet: overview and the + / − buttons on the left, breakdown on the right.
    return (
      <ScrollView contentContainerStyle={[page.wide, styles.content]} refreshControl={refresh}>
        <View style={page.columns}>
          <Surface style={[page.column, styles.card]} elevation={1}>
            {overview}
            <AddButtons />
          </Surface>
          <Surface style={[page.column, styles.card]} elevation={1}>
            {breakdown}
          </Surface>
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

function Total({ label, icon, value, color }: { label: string; icon: string; value: string; color: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.total, { backgroundColor: theme.colors.elevation.level2 }]}>
      <View style={styles.totalLabel}>
        <List.Icon icon={icon} color={color} style={styles.totalIcon} />
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text variant="titleMedium" style={[styles.number, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
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
  card: { borderRadius: 16, paddingBottom: 8, overflow: 'hidden' },
  chart: { alignItems: 'center', marginVertical: 8 },
  centerAmount: { maxWidth: '70%' },
  totals: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  total: { flex: 1, minWidth: 0, gap: 4, padding: 12, borderRadius: 12 },
  totalLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  totalIcon: { margin: 0, width: 18, height: 18 },
  number: { fontVariant: ['tabular-nums'] },
  share: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  shareBody: { flex: 1, minWidth: 0, gap: 6 },
  shareLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareName: { flex: 1 },
  shareAmount: { fontWeight: '600' },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  percent: { minWidth: 32, textAlign: 'right' },
  empty: { textAlign: 'center', padding: 24 },
});
