import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { useT } from '@/i18n/i18n';
import { useFormat } from '@/i18n/useFormat';
import { moneyColors } from '@/theme';
import type { Poisha } from '@/utils/money';

const HEIGHT = 180;
const TOP_PAD = 16;
const BOTTOM_PAD = 20;

/** Running totals: [0, day 1, day 1–2, …]. */
const cumulative = (days: Poisha[]) => days.reduce<number[]>((acc, v) => [...acc, acc[acc.length - 1]! + v], [0]);

type Props = {
  current: Poisha[];
  previous: Poisha[];
  previousLabel: string;
  /** Last day to draw for the current month (today); the whole month when it is over. */
  upToDay: number;
  /** Whole-month budget, drawn as an even-pace diagonal (like Copilot). */
  budget: Poisha | null;
};

/** Cumulative spending through the month against last month and the budget's even pace. Plain SVG. */
export function PaceChart({ current, previous, previousLabel, upToDay, budget }: Props) {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const colors = moneyColors(theme.dark);
  const font = theme.fonts.labelSmall.fontFamily; // SVG text defaults to serif on web
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const now = cumulative(current).slice(0, upToDay + 1);
  const before = cumulative(previous);
  const days = Math.max(current.length, previous.length);
  const max = Math.max(1, now[now.length - 1]!, before[before.length - 1]!, budget ?? 0);
  const x = (day: number) => (day / days) * (width - 8) + 4;
  const y = (v: number) => TOP_PAD + (HEIGHT - TOP_PAD - BOTTOM_PAD) * (1 - v / max);
  const points = (values: number[]) => values.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  const spent = now[now.length - 1]! as Poisha;
  const sameDayBefore = before[Math.min(upToDay, before.length - 1)]! as Poisha;
  const summary = t('reports.paceSummary', { spent: f.money(spent), previous: f.money(sameDayBefore), day: upToDay, month: previousLabel });
  const last = now.length - 1;

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={summary}>
      <Text variant="bodyMedium" style={[styles.summary, { color: theme.colors.onSurfaceVariant }]}>
        {summary}
      </Text>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          <Line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke={theme.colors.outlineVariant} strokeWidth={1} />
          <SvgText x={4} y={TOP_PAD - 4} fontSize={10} fontFamily={font} fill={theme.colors.onSurfaceVariant}>
            {f.compact(max as Poisha)}
          </SvgText>
          {[1, 15, days].map((d) => (
            <SvgText key={d} x={x(d)} y={HEIGHT - 4} fontSize={10} fontFamily={font} textAnchor={d === days ? 'end' : 'middle'} fill={theme.colors.onSurfaceVariant}>
              {f.num(d)}
            </SvgText>
          ))}
          {budget !== null && (
            <Line x1={x(0)} y1={y(0)} x2={x(current.length)} y2={y(budget)} stroke={theme.colors.primary} strokeWidth={1.5} strokeDasharray="4 4" />
          )}
          <Polyline points={points(before)} fill="none" stroke={theme.colors.outline} strokeWidth={2} strokeOpacity={0.6} strokeLinejoin="round" />
          <Polyline points={points(now)} fill="none" stroke={colors.expense} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={x(last)} cy={y(spent)} r={4.5} fill={colors.expense} stroke={theme.colors.elevation.level1} strokeWidth={2} />
        </Svg>
      )}
      <View style={styles.legend}>
        <Legend color={colors.expense} label={t('reports.thisMonth')} />
        <Legend color={theme.colors.outline} label={previousLabel} />
        {budget !== null && <Legend color={theme.colors.primary} label={t('reports.budgetPace')} dashed />}
      </View>
    </View>
  );
}

function Legend({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, dashed ? { borderColor: color, borderStyle: 'dashed', borderTopWidth: 2 } : { backgroundColor: color }]} />
      <Text variant="labelMedium">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { marginBottom: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 14, height: 3, borderRadius: 2 },
});
