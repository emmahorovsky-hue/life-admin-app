import { forwardRef } from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { radius, spacing } from '@life-admin/shared';
import { colors, textStyles } from '../../lib/theme';

export const Input = forwardRef<TextInput, TextInputProps>(function Input(
  { style, ...props },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.mutedForeground}
      style={[textStyles.body, styles.input, style]}
      {...props}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.base,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    color: colors.foreground,
  },
});
