import { StyleSheet, Text, TextProps } from 'react-native';
import { typeScale } from '@life-admin/shared';
import { colors, fontMono } from '../../lib/theme';

/** Monospace uppercase field label ("FIRST NAME") above an Input. */
export function FieldLabel({ style, ...props }: TextProps) {
  return <Text style={[styles.label, style]} {...props} />;
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fontMono,
    fontSize: typeScale.monoLabel.size,
    letterSpacing: typeScale.monoLabel.letterSpacing,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    marginBottom: 6,
  },
});
