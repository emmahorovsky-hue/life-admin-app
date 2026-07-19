import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { radius, spacing } from '@life-admin/shared';
import { colors, fonts } from '../../lib/theme';

type ButtonVariant = 'primary' | 'outline' | 'destructive';
type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: ButtonVariant;
  /** `sm` (h32) for row actions, `md` (h44) for form/primary actions. */
  size?: ButtonSize;
  /** Swaps the label for a spinner and blocks presses. */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  style,
  textStyle,
  ...props
}: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        pressed && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColors[variant]} />
      ) : (
        <Text style={[styles.label, sizeLabelStyles[size], { color: textColors[variant] }, textStyle]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const textColors: Record<ButtonVariant, string> = {
  primary: colors.background, // Snow on ink
  outline: colors.foreground,
  destructive: colors.background,
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.base,
  },
  label: { fontFamily: fonts.sans.semibold },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
});

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  sm: { height: 32, paddingHorizontal: spacing.md },
  md: { height: 44, paddingHorizontal: spacing.lg },
};

const sizeLabelStyles: Record<ButtonSize, TextStyle> = {
  sm: { fontSize: 13 },
  md: { fontSize: 14 },
};

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.foreground },
  outline: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' },
  destructive: { backgroundColor: colors.destructive },
};
