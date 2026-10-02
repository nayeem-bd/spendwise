import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { Category } from '@/lib/db/schema';

import { IconBadge } from './IconBadge';

export function CategoryGrid({ categories, value, onChange }: { categories: Category[]; value: string | null; onChange: (id: string) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {categories.map((c) => {
        const selected = c.id === value;
        return (
          <Pressable
            key={c.id}
            onPress={() => onChange(c.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={c.name}
            style={[styles.cell, selected && { backgroundColor: theme.colors.secondaryContainer }]}
          >
            <IconBadge icon={c.icon} color={c.color} size={40} />
            <Text variant="labelSmall" numberOfLines={2} style={styles.label}>
              {c.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '25%', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 2, borderRadius: 12, gap: 4 },
  label: { textAlign: 'center' },
});
