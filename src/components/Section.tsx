import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Divider, Text, useTheme } from 'react-native-paper';

import { IconBadge, type IconName } from './IconBadge';

type Props = {
  title?: string;
  /** Right side of the title line, e.g. a small action. */
  action?: ReactNode;
  /** Hairlines between rows, inset to line up with the row text (iOS style). */
  separators?: boolean;
  /** Left inset of the separators, in px. */
  inset?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** A rounded card on the screen background with an optional title above it (iOS "inset grouped" list). */
export function Section({ title, action, separators = false, inset = 72, style, children }: Props) {
  const theme = useTheme();
  const rows = Children.toArray(children);
  return (
    <View style={[styles.section, style]}>
      {(title || action) && (
        <View style={styles.titleRow}>
          <Text variant="labelLarge" style={[styles.title, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
            {title}
          </Text>
          {action}
        </View>
      )}
      <View style={[styles.card, { backgroundColor: theme.colors.elevation.level1 }]}>
        {separators
          ? rows.map((row, i) => (
              <Fragment key={i}>
                {i > 0 && <Divider style={{ marginLeft: inset }} />}
                {row}
              </Fragment>
            ))
          : children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: 16, marginTop: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24, marginBottom: 6, paddingHorizontal: 12 },
  title: { flex: 1 },
  card: { borderRadius: 16, overflow: 'hidden' },
});

/** `left` for a List.Item inside a Section: a small coloured rounded-square icon, like iOS Settings. */
export const rowIcon = (icon: IconName, color: string) =>
  function RowIcon() {
    return (
      <View style={rowStyles.icon}>
        <IconBadge icon={icon} color={color} size={30} square />
      </View>
    );
  };

/** Separator inset for rows that use `rowIcon`. */
export const ROW_ICON_INSET = 62;

const rowStyles = StyleSheet.create({
  icon: { marginLeft: 16, justifyContent: 'center' },
});

/**
 * For virtualised lists (FlatList / SectionList), where a Section can't wrap the
 * rows: renders one row as part of a rounded card, with a hairline above every
 * row but the first.
 */
export function CardRow({ index, count, inset = 72, children }: { index: number; count: number; inset?: number; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={[
        cardRowStyles.row,
        { backgroundColor: theme.colors.elevation.level1 },
        index === 0 && cardRowStyles.first,
        index === count - 1 && cardRowStyles.last,
      ]}
    >
      {index > 0 && <Divider style={{ marginLeft: inset }} />}
      {children}
    </View>
  );
}

const cardRowStyles = StyleSheet.create({
  row: { marginHorizontal: 16, overflow: 'hidden' },
  first: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  last: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
});
