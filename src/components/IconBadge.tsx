import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { iconColorOn } from '@/utils/color';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const isIconName = (name: string): name is IconName => name in MaterialCommunityIcons.glyphMap;

/**
 * A category/account icon on a coloured circle (or rounded square, like iOS
 * Settings icons). Unknown icon names fall back to a tag.
 */
export function IconBadge({
  icon,
  color,
  size = 40,
  square = false,
}: {
  icon: string | null;
  color: string | null;
  size?: number;
  square?: boolean;
}) {
  const name: IconName = icon && isIconName(icon) ? icon : 'tag';
  const background = color ?? '#757575';
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: square ? size * 0.28 : size / 2, backgroundColor: background }]}>
      <MaterialCommunityIcons name={name} size={size * 0.55} color={iconColorOn(background)} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
