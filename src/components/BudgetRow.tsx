import { StyleSheet, View } from 'react-native';
import { ProgressBar, Text, TouchableRipple, useTheme } from 'react-native-paper';

import { useT } from '@/i18n/i18n';
import { useDisplayName } from '@/i18n/names';
import { useFormat } from '@/i18n/useFormat';
import type { BudgetStatus } from '@/lib/db/repositories/budgets';
import { moneyColors } from '@/theme';
import type { Poisha } from '@/utils/money';

import { IconBadge } from './IconBadge';

const WARNING_COLOR = '#F9A825';

/** A budget with a progress bar: green under 80%, amber from 80%, red at 100%. */
export function BudgetRow({ status, onPress }: { status: BudgetStatus; onPress: () => void }) {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const displayName = useDisplayName();
  const name = status.categoryId === null ? t('budget.wholeMonth') : displayName(status.categoryId, status.name);
  const colors = moneyColors(theme.dark);
  const barColor = status.level === 'over' ? colors.expense : status.level === 'warning' ? WARNING_COLOR : colors.income;
  const left = (status.amount - status.spent) as Poisha;
  const percent = Math.round(status.ratio * 100);

  return (
    <TouchableRipple onPress={onPress} accessibilityRole="button" accessibilityLabel={t('budget.a11y', { name, percent })}>
      <View style={styles.row}>
        <IconBadge icon={status.icon} color={status.color ?? theme.colors.primary} size={36} />
        <View style={styles.body}>
          <View style={styles.line}>
            <Text variant="titleSmall">{name}</Text>
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  body: { flex: 1, gap: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  bar: { height: 8, borderRadius: 4 },
  number: { fontVariant: ['tabular-nums'] },
});
