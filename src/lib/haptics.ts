import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

type Kind = 'tap' | 'select' | 'success' | 'warning' | 'error';

const VIBRATE_MS: Record<Kind, number> = { tap: 8, select: 8, success: 15, warning: 20, error: 30 };

/**
 * Light touch feedback, like native keyboards and pickers. Web uses the
 * Vibration API (Android browsers; iOS Safari has none and stays silent).
 */
export function haptic(kind: Kind = 'tap') {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined') navigator.vibrate?.(VIBRATE_MS[kind]);
    return;
  }
  const done =
    kind === 'tap'
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : kind === 'select'
        ? Haptics.selectionAsync()
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType[kind === 'success' ? 'Success' : kind === 'warning' ? 'Warning' : 'Error']);
  done.catch(() => undefined); // no haptics engine (simulator, old device): nothing to feel
}
