import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { KeypadKey } from './keypad';

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'back'],
];

export function AmountKeypad({ onKey }: { onKey: (key: KeypadKey) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.pad}>
      {ROWS.map((row) => (
        <View key={row.join('')} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              onPress={() => onKey(key)}
              accessibilityRole="button"
              accessibilityLabel={key === 'back' ? 'Delete' : key === '.' ? 'Decimal point' : key}
              style={({ pressed }) => [
                styles.key,
                { backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.elevation.level1 },
              ]}
            >
              {key === 'back' ? (
                <MaterialCommunityIcons name="backspace-outline" size={24} color={theme.colors.onSurface} />
              ) : (
                <Text variant="headlineSmall">{key}</Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  key: { flex: 1, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
