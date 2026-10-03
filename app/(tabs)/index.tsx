import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { List, Text, useTheme } from 'react-native-paper';

import { AddButtons } from '@/components/AddButtons';
import { DonutChart } from '@/components/DonutChart';
import { IconBadge } from '@/components/IconBadge';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { useSyncRefresh } from '@/components/useSyncRefresh';
import { expenseByCategory, monthTotals } from '@/lib/db/repositories/summary';
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
  const name = useDisplayName();
  const colors = moneyColors(theme.dark);
  const month = useMonthStore((s) => s.month);
  const totals = useLocalQuery((db) => monthTotals(db, month), ['transactions'], [month]);
  const byCategory = useLocalQuery((db) => expenseByCategory(db, month), ['transactions', 'categories'], [month]);
  const { refreshing, onRefresh } = useSyncRefresh();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <MonthSwitcher />

        <View style={styles.chart}>
          <DonutChart
            emptyColor={theme.colors.surfaceVariant}
            segments={byCategory.map((c) => ({ key: c.categoryId ?? 'none', value: c.total, color: c.color ?? FALLBACK_COLOR }))}
          >
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('home.spent')}
            </Text>
            <Text variant="headlineSmall" style={[styles.number, { color: colors.expense }]} accessibilityLabel={`${t('home.spent')} ${f.money(totals.expense)}`}>
              {f.money(totals.expense)}
            </Text>
          </DonutChart>
        </View>

        <View style={styles.totals}>
          <Total label={t('type.income')} value={f.money(totals.income)} color={colors.income} />
          <Total label={t('type.expense')} value={f.money(totals.expense)} color={colors.expense} />
          <Total label={t('home.balance')} value={f.money(totals.balance)} color={totals.balance < 0 ? colors.expense : theme.colors.onSurface} />
        </View>

        {byCategory.length === 0 ? (
          <Text style={styles.empty}>{t('home.empty')}</Text>
        ) : (
          byCategory.map((c) => (
            <List.Item
              key={c.categoryId ?? 'none'}
              title={name(c.categoryId, c.name) || t('common.uncategorized')}
              description={totals.expense > 0 ? `${f.num(Math.round((c.total / totals.expense) * 100))}%` : undefined}
              left={() => (
                <View style={styles.icon}>
                  <IconBadge icon={c.icon} color={c.color} size={36} />
                </View>
              )}
              right={() => <Text style={[styles.number, styles.amount]}>{f.money(c.total)}</Text>}
            />
          ))
        )}
      </ScrollView>
      <AddButtons />
    </View>
  );
}

function Total({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.total}>
      <Text variant="labelMedium">{label}</Text>
      <Text variant="titleMedium" style={[styles.number, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  chart: { alignItems: 'center', marginVertical: 8 },
  totals: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  total: { flex: 1, alignItems: 'center', gap: 2 },
  number: { fontVariant: ['tabular-nums'] },
  amount: { alignSelf: 'center' },
  icon: { marginLeft: 16, justifyContent: 'center' },
  empty: { textAlign: 'center', padding: 24 },
});
