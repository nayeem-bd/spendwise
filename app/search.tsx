import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Divider, Searchbar, Text, TextInput, useTheme } from 'react-native-paper';

import { TransactionRow } from '@/components/TransactionRow';
import { translateError, useT, type StringKey } from '@/i18n/i18n';
import { useDisplayName } from '@/i18n/names';
import { useFormat } from '@/i18n/useFormat';
import { listCategories } from '@/lib/db/repositories/categories';
import { searchTransactions, totalsOf, type TransactionFilter } from '@/lib/db/repositories/transactions';
import type { TransactionType } from '@/lib/db/schema';
import { useLocalQuery } from '@/lib/db/useLocalQuery';
import { exportTransactions } from '@/lib/export/exportTransactions';
import { showNotice } from '@/store/notice';
import { moneyColors } from '@/theme';
import { addMonths, monthOf, monthRange, todayISO } from '@/utils/date';
import { parseTaka } from '@/utils/money';
import { page } from '@/components/layout';
import { EmptyState } from '@/components/EmptyState';

type Period = 'all' | 'month' | '3months' | 'year';

const PERIODS: { value: Period; label: StringKey }[] = [
  { value: 'all', label: 'search.allTime' },
  { value: 'month', label: 'search.thisMonth' },
  { value: '3months', label: 'search.last3Months' },
  { value: 'year', label: 'search.thisYear' },
];

const TYPES: { value: TransactionType; label: StringKey }[] = [
  { value: 'expense', label: 'type.expense' },
  { value: 'income', label: 'type.income' },
  { value: 'transfer', label: 'type.transfer' },
];

function periodRange(period: Period): { from?: string; to?: string } {
  const today = todayISO();
  const month = monthOf(today);
  switch (period) {
    case 'all':
      return {};
    case 'month':
      return { from: monthRange(month).start, to: today };
    case '3months':
      return { from: monthRange(addMonths(month, -2)).start, to: today };
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

export default function SearchScreen() {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const name = useDisplayName();
  const colors = moneyColors(theme.dark);
  const [text, setText] = useState('');
  const [period, setPeriod] = useState<Period>('all');
  const [types, setTypes] = useState<TransactionType[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');

  const categories = useLocalQuery((db) => listCategories(db), ['categories']);
  const filter: TransactionFilter = useMemo(
    () => ({
      text,
      types,
      categoryIds,
      ...periodRange(period),
      minAmount: parseTaka(minText) ?? undefined,
      maxAmount: parseTaka(maxText) ?? undefined,
    }),
    [text, types, categoryIds, period, minText, maxText],
  );
  const results = useLocalQuery((db) => searchTransactions(db, filter), ['transactions', 'categories', 'accounts'], [filter]);
  const totals = totalsOf(results);
  const [exporting, setExporting] = useState(false);
  const exportResults = async () => {
    setExporting(true);
    try {
      await exportTransactions(results);
    } catch (e) {
      showNotice(translateError(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: t('search.title') }} />
      <FlatList
        data={results}
        keyExtractor={(t) => t.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[page.list, styles.list]}
        ListHeaderComponent={
          <View style={styles.filters}>
            <Searchbar placeholder={t('search.placeholder')} value={text} onChangeText={setText} autoFocus />
            <ChipRow>
              {PERIODS.map((p) => (
                <Chip key={p.value} selected={period === p.value} showSelectedOverlay onPress={() => setPeriod(p.value)}>
                  {t(p.label)}
                </Chip>
              ))}
            </ChipRow>
            <ChipRow>
              {TYPES.map((ty) => (
                <Chip key={ty.value} selected={types.includes(ty.value)} showSelectedOverlay onPress={() => setTypes(toggle(types, ty.value))}>
                  {t(ty.label)}
                </Chip>
              ))}
            </ChipRow>
            <ChipRow>
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  selected={categoryIds.includes(c.id)}
                  showSelectedOverlay
                  onPress={() => setCategoryIds(toggle(categoryIds, c.id))}
                >
                  {name(c.id, c.name)}
                </Chip>
              ))}
            </ChipRow>
            <View style={styles.amounts}>
              <TextInput style={styles.amount} dense mode="outlined" label={t('search.min')} value={minText} onChangeText={setMinText} keyboardType="decimal-pad" />
              <TextInput style={styles.amount} dense mode="outlined" label={t('search.max')} value={maxText} onChangeText={setMaxText} keyboardType="decimal-pad" />
            </View>
            <Divider />
            <View style={styles.summaryRow}>
              <Text variant="labelLarge" style={styles.summary}>
                {t(results.length === 1 ? 'search.resultOne' : 'search.results', { count: results.length })}
                {totals.expense > 0 && <Text style={{ color: colors.expense }}> · −{f.money(totals.expense)}</Text>}
                {totals.income > 0 && <Text style={{ color: colors.income }}> · +{f.money(totals.income)}</Text>}
              </Text>
              <Button icon="download" compact onPress={exportResults} loading={exporting} disabled={exporting || results.length === 0}>
                CSV
              </Button>
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="magnify-close" text={t('search.empty')} />}
        renderItem={({ item }) => <TransactionRow item={item} showDate />}
      />
    </View>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 32 },
  filters: { padding: 16, gap: 10 },
  chips: { gap: 8 },
  amounts: { flexDirection: 'row', gap: 12 },
  amount: { flex: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summary: { flexShrink: 1 },
});
