import { StyleSheet, View } from 'react-native';
import { ProgressBar, Text, TouchableRipple, useTheme } from 'react-native-paper';

import { useT } from '@/i18n/i18n';
import { useDisplayName } from '@/i18n/names';
import { useFormat } from '@/i18n/useFormat';
import type { BudgetStatus } from '@/lib/db/repositories/budgets';
import { moneyColors } from '@/theme';
import { daysLeftInMonth } from '@/utils/date';
import type { Poisha } from '@/utils/money';

import { DonutChart } from './DonutChart';
import { IconBadge } from './IconBadge';

const WARNING_COLOR = '#F9A825';

const levelColor = (status: BudgetStatus, colors: ReturnType<typeof moneyColors>) =>
  status.level === 'over' ? colors.expense : status.level === 'warning' ? WARNING_COLOR : colors.income;

/** A budget with a progress bar: green under 80%, amber from 80%, red at 100%. */
export function BudgetRow({ status, onPress }: { status: BudgetStatus; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const displayName = useDisplayName();
  const name = status.categoryId === null ? t('budget.wholeMonth') : displayName(status.categoryId, status.name);
  const colors = moneyColors(theme.dark);
  const barColor = levelColor(status, colors);
  const left = (status.amount - status.spent) as Poisha;
  const percent = Math.round(status.ratio * 100);

  return (
    <TouchableRipple onPress={onPress} accessibilityRole="button" accessibilityLabel={t('budget.a11y', { name, percent })}>
      <View style={styles.row}>
        <IconBadge icon={status.icon} color={status.color ?? theme.colors.primary} size={36} />
        <View style={styles.body}>
          <View style={styles.line}>
            <Text variant="titleSmall" numberOfLines={1} style={styles.name}>
              {name}
            </Text>
            <Text variant="labelLarge" style={[styles.number, { color: left < 0 ? colors.expense : theme.colors.onSurface }]}>
              {left < 0 ? t('budget.over', { amount: f.money((-left) as Poisha) }) : t('budget.left', { amount: f.money(left) })}
            </Text>
          </View>
          <ProgressBar progress={Math.min(status.ratio, 1)} color={barColor} style={styles.bar} />
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('budget.spentOf', { spent: f.money(status.spent), amount: f.money(status.amount), percent })}
            {status.carriedFrom ? ` · ${t('budget.setIn', { month: f.month(status.carriedFrom) })}` : ''}
          </Text>
        </View>
      </View>
    </TouchableRipple>
  );
}

/**
 * The whole-month budget as a hero card: a progress ring, what is left, and a
 * daily allowance for the rest of the month (like Copilot or YNAB).
 */
export function BudgetHero({ status, month, onPress }: { status: BudgetStatus; month: string; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const colors = moneyColors(theme.dark);
  const left = (status.amount - status.spent) as Poisha;
  const percent = Math.round(status.ratio * 100);
  const days = daysLeftInMonth(month);
  const color = levelColor(status, colors);

  return (
    <TouchableRipple onPress={onPress} accessibilityRole="button" accessibilityLabel={t('budget.a11y', { name: t('budget.wholeMonth'), percent })}>
      <View style={styles.hero}>
        <DonutChart
          size={112}
          thickness={12}
          emptyColor={theme.colors.surfaceVariant}
          segments={[
            { key: 'spent', value: Math.min(status.spent, status.amount), color },
            { key: 'left', value: Math.max(left, 0), color: theme.colors.surfaceVariant },
          ]}
        >
          <Text variant="titleMedium" style={[styles.number, styles.bold]}>
            {f.num(percent)}%
          </Text>
        </DonutChart>
        <View style={styles.body}>
          <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('budget.monthly')}
          </Text>
          <Text variant="headlineSmall" numberOfLines={1} adjustsFontSizeToFit style={[styles.number, styles.bold, { color: left < 0 ? colors.expense : theme.colors.onSurface }]}>
            {left < 0 ? t('budget.over', { amount: f.money((-left) as Poisha) }) : t('budget.left', { amount: f.money(left) })}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('budget.spentOf', { spent: f.money(status.spent), amount: f.money(status.amount), percent })}
          </Text>
          {days > 0 && left > 0 && (
            <View style={[styles.chip, { backgroundColor: theme.colors.secondaryContainer }]}>
              <Text variant="labelMedium" style={[styles.number, { color: theme.colors.onSecondaryContainer }]}>
                {days === 1
                  ? t('budget.perDayLast', { amount: f.money(left) })
                  : t('budget.perDay', { amount: f.money(Math.floor(left / days) as Poisha), days: f.num(days) })}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  body: { flex: 1, minWidth: 0, gap: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  bar: { height: 8, borderRadius: 4 },
  name: { flex: 1 },
  number: { fontVariant: ['tabular-nums'] },
  bold: { fontWeight: '700' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 20, padding: 16 },
  chip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
});
