import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { useDisplayName } from '@/i18n/names';
import type { Category } from '@/lib/db/schema';

import { IconBadge } from './IconBadge';

const MIN_CELL = 84; // px: icon plus a two-line label

/** Category picker. Four per row on phones, more as the space grows. */
export function CategoryGrid({ categories, value, onChange }: { categories: Category[]; value: string | null; onChange: (id: string) => void }) {
  const theme = useTheme();
  const name = useDisplayName();
  const [width, setWidth] = useState(0);
  const columns = Math.max(4, Math.min(8, Math.floor(width / MIN_CELL)));
  return (
    <View style={styles.grid} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {categories.map((c) => {
        const selected = c.id === value;
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(c.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={name(c.id, c.name)}
            style={({ pressed }) => [
              styles.cell,
              { width: `${100 / columns}%` },
              pressed && !selected && { backgroundColor: theme.colors.elevation.level2 },
              selected && { backgroundColor: theme.colors.secondaryContainer },
            ]}
          >
            <IconBadge icon={c.icon} color={c.color} size={40} />
            <Text variant="labelSmall" numberOfLines={2} style={styles.label}>
              {name(c.id, c.name)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 2, borderRadius: 12, gap: 4 },
  label: { textAlign: 'center' },
});
