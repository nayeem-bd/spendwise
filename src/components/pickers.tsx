import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';

import { IconBadge } from './IconBadge';

export const CATEGORY_ICONS = [
  'food-apple', 'food', 'coffee', 'cart', 'bus', 'car', 'motorbike', 'train', 'airplane', 'gas-station',
  'home', 'flash', 'water', 'fire', 'wifi', 'cellphone', 'shopping', 'tshirt-crew', 'medical-bag', 'pill',
  'school', 'book-open-variant', 'account-group', 'baby-carriage', 'paw', 'movie-open', 'gamepad-variant',
  'gift', 'heart', 'briefcase', 'store', 'laptop', 'cash', 'bank', 'hand-coin', 'dots-horizontal',
];

export const ACCOUNT_ICONS = ['cash', 'wallet', 'bank', 'cellphone', 'credit-card', 'piggy-bank', 'safe', 'briefcase'];

export const COLORS = [
  '#EF6C00', '#E53935', '#D81B60', '#8E24AA', '#5E35B1', '#3949AB', '#1E88E5', '#00ACC1',
  '#00897B', '#43A047', '#2E7D32', '#FDD835', '#6D4C41', '#757575', '#E2136E', '#1565C0',
];

function Selectable({ selected, onPress, children }: { selected: boolean; onPress: () => void; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.cell, { borderColor: selected ? theme.colors.primary : 'transparent' }]}
    >
      {children}
    </Pressable>
  );
}

export function IconPicker({ icons, value, color, onChange }: { icons: string[]; value: string; color: string; onChange: (icon: string) => void }) {
  return (
    <View style={styles.grid}>
      {icons.map((icon) => (
        <Selectable key={icon} selected={icon === value} onPress={() => onChange(icon)}>
          <IconBadge icon={icon} color={icon === value ? color : '#9E9E9E'} size={36} />
        </Selectable>
      ))}
    </View>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <View style={styles.grid}>
      {COLORS.map((color) => (
        <Selectable key={color} selected={color === value} onPress={() => onChange(color)}>
          <View style={[styles.swatch, { backgroundColor: color }]} />
        </Selectable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { padding: 3, borderWidth: 2, borderRadius: 24 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
});
