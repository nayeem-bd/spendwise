import { StyleSheet, View } from 'react-native';
import { ProgressBar, Text, TouchableRipple, useTheme } from 'react-native-paper';

import type { BudgetStatus } from '@/lib/db/repositories/budgets';
import { moneyColors } from '@/theme';
import { formatMonth } from '@/utils/date';
import { formatBDT, type Poisha } from '@/utils/money';

import { IconBadge } from './IconBadge';

const WARNING_COLOR = '#F9A825';

/** A budget with a progress bar: green under 80%, amber from 80%, red at 100%. */
export function BudgetRow({ status, onPress }: { status: BudgetStatus; onPress: () => void }) {
  const theme = useTheme();
  const colors = moneyColors(theme.dark);
  const barColor = status.level === 'over' ? colors.expense : status.level === 'warning' ? WARNING_COLOR : colors.income;
  const left = (status.amount - status.spent) as Poisha;
  const percent = Math.round(status.ratio * 100);

  return (
    <TouchableRipple onPress={onPress} accessibilityRole="button" accessibilityLabel={`${status.name} budget, ${percent}% used`}>
      <View style={styles.row}>
        <IconBadge icon={status.icon} color={status.color ?? theme.colors.primary} size={36} />
        <View style={styles.body}>
          <View style={styles.line}>
            <Text variant="titleSmall">{status.name}</Text>
            <Text variant="labelLarge" style={[styles.number, { color: left < 0 ? colors.expense : theme.colors.onSurface }]}>
              {left < 0 ? `${formatBDT((-left) as Poisha)} over` : `${formatBDT(left)} left`}
            </Text>
          </View>
          <ProgressBar progress={Math.min(status.ratio, 1)} color={barColor} style={styles.bar} />
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {formatBDT(status.spent)} of {formatBDT(status.amount)} · {percent}%
            {status.carriedFrom ? ` · set in ${formatMonth(status.carriedFrom)}` : ''}
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
