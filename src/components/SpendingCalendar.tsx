import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { useT } from '@/i18n/i18n';
import { useFormat } from '@/i18n/useFormat';
import { moneyColors } from '@/theme';
import { todayISO, weekdayNames } from '@/utils/date';
import type { Poisha } from '@/utils/money';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The month as a calendar heatmap (like Money Manager's calendar tab): each
 * day tinted by how much was spent, with the amount underneath. Weeks start on Sunday.
 */
export function SpendingCalendar({ month, days }: { month: string; days: Poisha[] }) {
  const theme = useTheme();
  const { t, lang } = useT();
  const f = useFormat();
  const colors = moneyColors(theme.dark);
  const today = todayISO();
  const [y, m] = month.split('-').map(Number);
  const leading = new Date(Date.UTC(y!, m! - 1, 1)).getUTCDay();
  const max = Math.max(1, ...days);
  const cells = [...Array<null>(leading).fill(null), ...days.map((v, i) => ({ day: i + 1, value: v }))];

  return (
    <View style={styles.calendar}>
      <View style={styles.row}>
        {weekdayNames(lang).map((d) => (
          <Text key={d} variant="labelSmall" style={[styles.cell, styles.head, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.row}>
        {cells.map((c, i) => {
          if (!c) return <View key={`blank-${i}`} style={styles.cell} />;
          const iso = `${month}-${pad(c.day)}`;
          const label = t('reports.dayA11y', { day: f.day(iso), amount: f.money(c.value) });
          return (
            <View key={iso} style={styles.cell} accessible accessibilityLabel={label}>
              <View style={[styles.day, iso === today && { borderColor: theme.colors.primary, borderWidth: 2 }]}>
                {c.value > 0 && (
                  // sqrt so a few big days don't wash out the rest. Lower cap in dark mode keeps light text at 4.5:1.
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.expense, opacity: 0.12 + (theme.dark ? 0.33 : 0.6) * Math.sqrt(c.value / max) }]} />
                )}
                <Text variant="labelMedium" style={iso > today && { color: theme.colors.onSurfaceVariant }}>
                  {f.num(c.day)}
                </Text>
                {c.value > 0 && (
                  <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>
                    {f.compact(c.value)}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { width: '100%', maxWidth: 420, alignSelf: 'center' }, // big squares on desktop push the rest down
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, padding: 2 },
  head: { textAlign: 'center', paddingBottom: 4 },
  day: { aspectRatio: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingHorizontal: 2 },
  amount: { fontSize: 11, fontVariant: ['tabular-nums'] },
});
