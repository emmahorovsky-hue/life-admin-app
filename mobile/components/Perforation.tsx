import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../lib/theme';

/**
 * Receipt-style dashed separator. iOS only renders borderStyle 'dashed' when
 * the border is drawn on all four edges, so a single borderBottom dashed line
 * silently falls back to solid — instead we clip a 4-side dashed box down to
 * its top edge.
 */
export function Perforation({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.clip, style]}>
      <View style={styles.dashes} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { height: 2, overflow: 'hidden' },
  dashes: {
    height: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
});
