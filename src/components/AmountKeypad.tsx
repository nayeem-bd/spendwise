import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { useT } from '@/i18n/i18n';
import { localDigits } from '@/utils/digits';

import type { KeypadKey } from './keypad';

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'back'],
];

const KEYBOARD_KEYS: Record<string, KeypadKey> = {
  ...Object.fromEntries([...'0123456789'].map((d) => [d, d as KeypadKey])),
  '.': '.',
  ',': '.',
  Backspace: 'back',
};

/**
 * On web, a physical keyboard types into the amount (digits, `.`, Backspace)
 * and Enter submits, unless the focus is in a text field such as the note.
 */
function useHardwareKeys(onKey: (key: KeypadKey) => void, onSubmit?: () => void) {
  const handlers = useRef({ onKey, onSubmit });
  handlers.current = { onKey, onSubmit };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const listener = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Enter on a focused button presses that button instead.
      if (e.key === 'Enter' && handlers.current.onSubmit && !target?.closest('button, a, [role="button"]')) {
        e.preventDefault();
        handlers.current.onSubmit();
        return;
      }
      const key = KEYBOARD_KEYS[e.key];
      if (key) {
        e.preventDefault();
        handlers.current.onKey(key);
      }
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
}

/** Number pad for the amount. `dense` uses shorter keys, for when it's docked under other content. */
export function AmountKeypad({ onKey, onSubmit, dense = false }: { onKey: (key: KeypadKey) => void; onSubmit?: () => void; dense?: boolean }) {
  const theme = useTheme();
  const { t, lang } = useT();
  useHardwareKeys(onKey, onSubmit);
  return (
    <View style={styles.pad}>
      {ROWS.map((row) => (
        <View key={row.join('')} style={styles.row}>
          {row.map((key) => (
            <Pressable
              key={key}
              onPress={() => onKey(key)}
              accessibilityRole="button"
              accessibilityLabel={key === 'back' ? t('common.delete') : key === '.' ? t('transaction.decimalPoint') : key}
              style={({ pressed }) => [
                styles.key,
                dense && styles.denseKey,
                { backgroundColor: pressed ? theme.colors.surfaceVariant : theme.colors.elevation.level1 },
              ]}
            >
              {key === 'back' ? (
                <MaterialCommunityIcons name="backspace-outline" size={24} color={theme.colors.onSurface} />
              ) : (
                <Text variant="headlineSmall">{localDigits(key, lang)}</Text>
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
  denseKey: { height: 44 },
});
