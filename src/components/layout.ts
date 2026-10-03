import { StyleSheet, useWindowDimensions } from 'react-native';

/** Material 3 window size classes: phone, tablet / small window, desktop. */
export type WindowClass = 'compact' | 'medium' | 'expanded';

export const windowClassFor = (width: number): WindowClass => (width < 600 ? 'compact' : width < 840 ? 'medium' : 'expanded');

/**
 * Window size class of the current window. `compact` uses a bottom tab bar and
 * one column; `medium` adds a navigation rail; `expanded` adds a sidebar and
 * two-column screens.
 */
export function useWindowClass() {
  const { width } = useWindowDimensions();
  const size = windowClassFor(width);
  return { width, size, compact: size === 'compact', expanded: size === 'expanded' };
}

/** Centred content columns: `narrow` for forms, `list` for single lists, `wide` for two-column screens. */
export const page = StyleSheet.create({
  narrow: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  list: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  wide: { width: '100%', maxWidth: 1120, alignSelf: 'center' },
  /** Two side-by-side columns (use inside `wide`). */
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 24, paddingHorizontal: 16 },
  column: { flex: 1, minWidth: 0 },
});
