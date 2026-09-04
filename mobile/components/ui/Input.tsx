import { forwardRef } from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
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

/**
 * `Input` for use inside a FormSheet or any other BottomSheetModal.
 *
 * Two components rather than a mode of one, because neither can do the other's
 * job: `BottomSheetTextInput` calls `useBottomSheetInternal()`, which *throws*
 * outside a sheet — and `Input` is used on every auth screen — while a plain
 * `TextInput` inside a sheet never tells gorhom which field has focus, so
 * `keyboardBehavior` has nothing to lift the sheet to.
 *
 * They share `styles.input` deliberately: two components that must stay
 * pixel-identical belong in one file, next to each other.
 */
export function SheetInput({ style, ...props }: TextInputProps) {
  return (
    <BottomSheetTextInput
      placeholderTextColor={colors.mutedForeground}
      style={[textStyles.body, styles.input, style]}
      {...props}
    />
  );
}

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
