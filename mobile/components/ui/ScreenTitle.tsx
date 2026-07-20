import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { colors } from '../../lib/theme';
import { AppText } from './AppText';

/** Page-title convention: pageTitle role (Archivo bold 30) + brand-orange period. */
export function ScreenTitle({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <AppText variant="pageTitle" style={style}>
      {children}
      <Text style={styles.accent}>.</Text>
    </AppText>
  );
}

const styles = StyleSheet.create({
  accent: { color: colors.brandOrange },
});
