import { Text, TextProps, TextStyle } from 'react-native';
import { typeScale } from '@life-admin/shared';
import { colors, fontFamilyFor, textStyles, TextVariant } from '../../lib/theme';

/** Weights that have a loaded Archivo family (sans). Mono only has 400/700. */
type Weight = 400 | 500 | 600 | 700 | 800;

export interface AppTextProps extends TextProps {
  /** Semantic role from the shared type scale. Defaults to `body`. */
  variant?: TextVariant;
  /** Override the family weight (stays within the variant's family kind). */
  weight?: Weight;
  /** Use the muted foreground colour instead of the default ink. */
  muted?: boolean;
  /** Explicit colour override (wins over `muted`). */
  color?: string;
}

const HEADER_VARIANTS: ReadonlySet<TextVariant> = new Set(['pageTitle', 'title']);

/**
 * The single text primitive (LIF-210). Every string in the app renders through
 * this so it picks a scale role instead of a raw `fontSize`. Colour defaults to
 * ink; `muted`/`color` adjust it; `weight` re-picks the family within the
 * variant's kind (sans vs mono). Title-ish variants announce as headers.
 */
export function AppText({
  variant = 'body',
  weight,
  muted,
  color,
  style,
  accessibilityRole,
  ...rest
}: AppTextProps) {
  const override: TextStyle = {};

  if (weight) {
    const mono = 'mono' in typeScale[variant] && (typeScale[variant] as { mono?: boolean }).mono === true;
    const family = fontFamilyFor(weight, mono);
    if (family) override.fontFamily = family;
  }
  if (color) override.color = color;
  else if (muted) override.color = colors.mutedForeground;

  return (
    <Text
      accessibilityRole={accessibilityRole ?? (HEADER_VARIANTS.has(variant) ? 'header' : undefined)}
      style={[textStyles[variant], override, style]}
      {...rest}
    />
  );
}
