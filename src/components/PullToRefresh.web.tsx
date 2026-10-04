import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View, type RefreshControlProps } from 'react-native';
import { useTheme } from 'react-native-paper';

const THRESHOLD = 64; // pull (after resistance) that triggers a refresh on release
const MAX_PULL = 110;
const HOLD = 52; // where the content rests while refreshing
const RESISTANCE = 0.5; // finger travel → pull distance
const SPINNER = 36;

/**
 * Web: react-native-web's RefreshControl renders nothing, so the installed PWA
 * gets this touch-driven version. ScrollView passes itself in as `children`;
 * pulling down while it's scrolled to the top drags the content down with a
 * spinner above it, and releasing past the threshold calls `onRefresh`.
 * Mouse and trackpad are left alone.
 */
export function PullToRefresh({ refreshing, onRefresh, enabled = true, children }: RefreshControlProps & { children?: ReactNode }) {
  const theme = useTheme();
  const wrapRef = useRef<View>(null);
  const contentRef = useRef<View>(null);
  const pull = useRef(new Animated.Value(0)).current;
  const [armed, setArmed] = useState(false);
  // Read by the DOM listeners, which are attached once.
  const live = useRef({ refreshing, onRefresh, enabled, active: false, startX: 0, startY: 0, distance: 0 });
  Object.assign(live.current, { refreshing, onRefresh, enabled });

  const settle = (toValue: number) => Animated.spring(pull, { toValue, useNativeDriver: false, bounciness: 0, speed: 20 }).start();

  useEffect(() => {
    if (refreshing) settle(HOLD);
    else if (!live.current.active) settle(0);
    // settle only touches the stable Animated.Value.
  }, [refreshing]);

  useEffect(() => {
    // On web, refs to host components are DOM elements.
    const wrap = wrapRef.current as unknown as HTMLElement | null;
    const content = contentRef.current as unknown as HTMLElement | null;
    if (!wrap || !content) return;
    const atTop = () => ((content.firstElementChild as HTMLElement | null)?.scrollTop ?? 0) <= 0;
    const s = live.current;

    const start = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch || e.touches.length !== 1 || !s.enabled || s.refreshing || !atTop()) return;
      s.active = true;
      s.startX = touch.clientX;
      s.startY = touch.clientY;
      s.distance = 0;
    };
    const move = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!s.active || !touch) return;
      const dy = touch.clientY - s.startY;
      const dx = Math.abs(touch.clientX - s.startX);
      if (s.distance === 0) {
        if (dy === 0) return;
        // Scrolling up or sideways, or the list moved: not a pull.
        if (dy < 0 || dx > dy || !atTop()) {
          s.active = false;
          return;
        }
      }
      e.preventDefault(); // keep the browser from scrolling or bouncing the page
      s.distance = Math.min(MAX_PULL, Math.max(0, dy * RESISTANCE));
      pull.setValue(s.distance);
      setArmed(s.distance >= THRESHOLD);
    };
    const end = () => {
      if (!s.active) return;
      s.active = false;
      setArmed(false);
      if (s.distance >= THRESHOLD) {
        settle(HOLD);
        s.onRefresh?.();
      } else {
        settle(0);
      }
      s.distance = 0;
    };

    wrap.addEventListener('touchstart', start, { passive: true });
    wrap.addEventListener('touchmove', move, { passive: false });
    wrap.addEventListener('touchend', end);
    wrap.addEventListener('touchcancel', end);
    return () => {
      wrap.removeEventListener('touchstart', start);
      wrap.removeEventListener('touchmove', move);
      wrap.removeEventListener('touchend', end);
      wrap.removeEventListener('touchcancel', end);
    };
    // Attached once; current props are read through `live`.
  }, []);

  const spinnerY = pull.interpolate({ inputRange: [0, MAX_PULL], outputRange: [-SPINNER - 8, MAX_PULL - SPINNER - 8] });
  const opacity = pull.interpolate({ inputRange: [0, 24], outputRange: [0, 1], extrapolate: 'clamp' });
  const rotate = pull.interpolate({ inputRange: [0, THRESHOLD], outputRange: ['0deg', '180deg'], extrapolate: 'clamp' });

  return (
    // Not the `style` react-native-web passes in: that's the ScrollView's own
    // style (overflowY: auto), which would make this wrapper scroll as well
    // once the content is pulled down.
    <View ref={wrapRef} style={[styles.fill, styles.clip]}>
      <Animated.View style={[styles.fill, { transform: [{ translateY: pull }] }]}>
        <View ref={contentRef} style={styles.fill}>
          {children}
        </View>
      </Animated.View>
      <Animated.View
        style={[styles.spinner, { backgroundColor: theme.colors.elevation.level3, opacity, transform: [{ translateY: spinnerY }] }]}
        accessibilityElementsHidden
      >
        {refreshing ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <Animated.View style={{ transform: [{ rotate }] }}>
            <MaterialCommunityIcons name="arrow-down" size={20} color={armed ? theme.colors.primary : theme.colors.onSurfaceVariant} />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  clip: { overflow: 'hidden' },
  spinner: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    width: SPINNER,
    height: SPINNER,
    borderRadius: SPINNER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
  },
});
