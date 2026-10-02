import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const isIconName = (name: string): name is IconName => name in MaterialCommunityIcons.glyphMap;

/** A category/account icon on a coloured circle. Unknown icon names fall back to a tag. */
export function IconBadge({ icon, color, size = 40 }: { icon: string | null; color: string | null; size?: number }) {
  const name: IconName = icon && isIconName(icon) ? icon : 'tag';
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? '#757575' }]}>
      <MaterialCommunityIcons name={name} size={size * 0.55} color="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
