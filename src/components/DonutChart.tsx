import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

export type DonutSegment = { key: string; value: number; color: string };

type Props = { segments: DonutSegment[]; size?: number; thickness?: number; emptyColor: string; children?: ReactNode };

const GAP = 2; // px between segments

/**
 * A donut chart drawn with plain SVG circles (stroke-dasharray per segment),
 * so it renders the same on iOS, Android and web.
 */
export function DonutChart({ segments, size = 220, thickness = 28, emptyColor, children }: Props) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  const gap = visible.length > 1 ? GAP : 0;

  let offset = 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={emptyColor} strokeWidth={thickness} fill="none" />
          {total > 0 &&
            visible.map((s) => {
              const length = (s.value / total) * circumference;
              const dash = Math.max(length - gap, 0.5);
              const circle = (
                <Circle
                  key={s.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={s.color}
                  strokeWidth={thickness}
                  fill="none"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += length;
              return circle;
            })}
        </G>
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
