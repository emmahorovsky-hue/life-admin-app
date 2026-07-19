import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { typeScale } from '@life-admin/shared';
import { colors, fonts } from '../../lib/theme';

/** Page-title convention: Archivo bold 30 + brand-orange period. */
export function ScreenTitle({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text accessibilityRole="header" style={[styles.title, style]}>
      {children}
      <Text style={styles.accent}>.</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.sans.bold, // typeScale.pageTitle.weight (700)
    fontSize: typeScale.pageTitle.size,
    color: colors.foreground,
  },
  accent: { color: colors.brandOrange },
});
