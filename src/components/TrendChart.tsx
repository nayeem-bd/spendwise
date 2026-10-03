import { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { useT } from '@/i18n/i18n';
import { useFormat } from '@/i18n/useFormat';
import type { MonthPoint } from '@/lib/db/repositories/summary';
import { moneyColors } from '@/theme';
import type { Poisha } from '@/utils/money';

const HEIGHT = 200;
const LABEL_HEIGHT = 20;
const TOP_PAD = 16;

/** Grouped income/expense bars per month, drawn with plain SVG so it matches on every platform. */
export function TrendChart({ data, selected }: { data: MonthPoint[]; selected: string }) {
  const theme = useTheme();
  const { t } = useT();
  const f = useFormat();
  const colors = moneyColors(theme.dark);
  const font = theme.fonts.labelSmall.fontFamily; // SVG text defaults to serif on web
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const plot = HEIGHT - LABEL_HEIGHT - TOP_PAD;
  const slot = width / Math.max(data.length, 1);
  const bar = Math.max(4, Math.min(18, slot / 4));
  const y = (v: number) => TOP_PAD + plot - (v / max) * plot;

  return (
    <View onLayout={onLayout} accessibilityRole="image" accessibilityLabel={data.map((d) => t('reports.a11yMonth', { month: f.month(d.month), income: f.compact(d.income), expense: f.compact(d.expense) })).join('; ')}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          <Line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke={theme.colors.outlineVariant} strokeWidth={1} />
          <SvgText x={2} y={TOP_PAD - 4} fontSize={10} fontFamily={font} fill={theme.colors.onSurfaceVariant}>
            {f.compact(max as Poisha)}
          </SvgText>
          {data.map((d, i) => {
            const cx = slot * i + slot / 2;
            const isSelected = d.month === selected;
            return [
              <Rect key={`${d.month}-i`} x={cx - bar - 1} y={y(d.income)} width={bar} height={y(0) - y(d.income)} rx={3} fill={colors.income} opacity={isSelected ? 1 : 0.55} />,
              <Rect key={`${d.month}-e`} x={cx + 1} y={y(d.expense)} width={bar} height={y(0) - y(d.expense)} rx={3} fill={colors.expense} opacity={isSelected ? 1 : 0.55} />,
              <SvgText
                key={`${d.month}-l`}
                x={cx}
                y={HEIGHT - 4}
                fontSize={11}
                fontFamily={font}
                fontWeight={isSelected ? 'bold' : 'normal'}
                textAnchor="middle"
                fill={theme.colors.onSurface}
              >
                {f.month(d.month).split(' ')[0]}
              </SvgText>,
            ];
          })}
        </Svg>
      )}
      <View style={styles.legend}>
        <Legend color={colors.income} label={t('type.income')} />
        <Legend color={colors.expense} label={t('type.expense')} />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text variant="labelMedium">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
});
