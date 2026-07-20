import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { radius, spacing } from '@life-admin/shared';
import { colors } from '../../lib/theme';
import { AppText } from './AppText';

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
        <AppText
          variant={size === 'sm' ? 'footnote' : 'body'}
          weight={600}
          style={[{ color: textColors[variant] }, textStyle]}
        >
          {title}
        </AppText>
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
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
});

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  sm: { height: 32, paddingHorizontal: spacing.md },
  md: { height: 44, paddingHorizontal: spacing.lg },
};

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.foreground },
  outline: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' },
  destructive: { backgroundColor: colors.destructive },
};
