import { StyleSheet, View } from 'react-native';
import { List, Text, useTheme } from 'react-native-paper';

import { useT } from '@/i18n/i18n';
import { useFormat } from '@/i18n/useFormat';
import type { MonthTotals as Totals } from '@/lib/db/repositories/summary';
import { moneyColors } from '@/theme';

/**
 * Income, expense and balance tiles for a month. `dense` for the top of lists;
 * `onCard` when they sit inside a Section card rather than on the background.
 */
export function MonthTotals({ totals, dense = false, onCard = false }: { totals: Totals; dense?: boolean; onCard?: boolean }) {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const colors = moneyColors(theme.dark);
  const tile = onCard ? theme.colors.elevation.level2 : theme.colors.elevation.level1;
  return (
    <View style={[styles.row, dense && styles.denseRow]}>
      <Total label={t('type.income')} icon="arrow-down" value={f.money(totals.income)} color={colors.income} dense={dense} tile={tile} />
      <Total label={t('type.expense')} icon="arrow-up" value={f.money(totals.expense)} color={colors.expense} dense={dense} tile={tile} />
      <Total
        label={t('home.balance')}
        icon="scale-balance"
        value={f.money(totals.balance)}
        color={totals.balance < 0 ? colors.expense : theme.colors.onSurface}
        dense={dense}
        tile={tile}
      />
    </View>
  );
}

type TotalProps = { label: string; icon: string; value: string; color: string; dense: boolean; tile: string };

function Total({ label, icon, value, color, dense, tile }: TotalProps) {
  const theme = useTheme();
  return (
    <View
      style={[styles.total, dense && styles.denseTotal, { backgroundColor: tile }]}
      accessible
      accessibilityLabel={`${label} ${value}`}
    >
      <View style={styles.label}>
        <List.Icon icon={icon} color={color} style={styles.icon} />
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text variant={dense ? 'titleSmall' : 'titleMedium'} style={[styles.number, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  denseRow: { paddingTop: 0, paddingBottom: 8 },
  total: { flex: 1, minWidth: 0, gap: 4, padding: 12, borderRadius: 14 },
  denseTotal: { paddingVertical: 8, gap: 2 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  icon: { margin: 0, width: 18, height: 18 },
  number: { fontVariant: ['tabular-nums'] },
});
