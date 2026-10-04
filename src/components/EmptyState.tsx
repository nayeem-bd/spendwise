import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { IconName } from './IconBadge';

/** A muted icon and message for a screen or section with nothing to show yet. */
export function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.box}>
      <MaterialCommunityIcons name={icon} size={40} color={theme.colors.outline} />
      <Text variant="bodyMedium" style={[styles.text, { color: theme.colors.onSurfaceVariant }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 8, paddingHorizontal: 32, paddingVertical: 24 },
  text: { textAlign: 'center', maxWidth: 360 },
});
