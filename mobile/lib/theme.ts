import { StyleSheet, TextStyle } from 'react-native';
import { lightColors, typeScale } from '@life-admin/shared';

// Light palette sourced from the shared design tokens (LIF-196) — the same
// values `client/src/index.css` `:root` renders, so web and mobile can no
// longer drift. The app is light-only (userInterfaceStyle: 'light' in
// app.config.ts); dark mode on mobile is deferred, dark tokens live web-only.
export const colors = {
  background: lightColors.background.hex, // Snow
  // Mobile deliberately floats white cards on the snow background (web's
  // --card is Snow itself, matching its paper-sheet look).
  card: lightColors.white.hex,
  foreground: lightColors.foreground.hex,
  brandOrange: lightColors.brandOrange.hex,
  secondary: lightColors.secondary.hex, // Sand
  mutedForeground: lightColors.mutedForeground.hex,
  border: lightColors.border.hex, // Ash
  destructive: lightColors.destructive.hex,
  success: lightColors.success.hex,
  warning: lightColors.warning.hex,
  white: lightColors.white.hex,

  // Dashboard "Quiet" 1b warm-neutral tints (LIF-211). Mobile-only and kept out
  // of the shared palette on purpose: the web drift test asserts lightColors
  // matches client/src/index.css :root, and these tints have no web counterpart.
  softMuted: '#A8A29B', // secondary labels — timing, eyebrow, axis, current month
  faint: '#C4BFB7', // de-emphasized figures (decimal part) + inactive tab tint
  insightBody: '#57534E', // savings-insight paragraph (darker warm gray)
  hairline: '#EAE7E1', // primary hairline divider
  rowDivider: '#F0EDE7', // lighter renewal-row separators
};

// Typefaces matching the web app (LIF-197), loaded in app/_layout.tsx via
// expo-font. RN static fonts are one family per weight: never pair these with
// fontWeight — pick the weight-specific family instead.
export const fonts = {
  sans: {
    regular: 'Archivo_400Regular',
    medium: 'Archivo_500Medium',
    semibold: 'Archivo_600SemiBold',
    bold: 'Archivo_700Bold',
    extrabold: 'Archivo_800ExtraBold',
  },
  mono: {
    regular: 'SpaceMono_400Regular',
    bold: 'SpaceMono_700Bold',
  },
};

export const fontMono = fonts.mono.regular;
export const fontMonoBold = fonts.mono.bold;

// ─────────────────────────────────────────────────────────────────────────────
// Type scale → concrete text styles (LIF-210).
//
// The shared `typeScale` names semantic roles + CSS weights; RN loads one family
// per weight, so we map (weight, mono?) → a concrete family here. `textStyles`
// resolves every role once; the <AppText> primitive is the intended consumer.
// ─────────────────────────────────────────────────────────────────────────────

const sansByWeight: Record<number, string> = {
  400: fonts.sans.regular,
  500: fonts.sans.medium,
  600: fonts.sans.semibold,
  700: fonts.sans.bold,
  800: fonts.sans.extrabold,
};

const monoByWeight: Record<number, string> = {
  400: fonts.mono.regular,
  700: fonts.mono.bold,
};

/** Resolve a loaded RN font family for a CSS weight, sans or mono. */
export function fontFamilyFor(weight: number, mono: boolean): string | undefined {
  return (mono ? monoByWeight : sansByWeight)[weight];
}

export type TextVariant = keyof typeof typeScale;

const resolved = Object.fromEntries(
  Object.entries(typeScale).map(([name, t]) => {
    const mono = 'mono' in t && t.mono === true;
    const style: TextStyle = {
      fontFamily: fontFamilyFor(t.weight, mono),
      fontSize: t.size,
      color: colors.foreground,
    };
    if ('letterSpacing' in t) style.letterSpacing = t.letterSpacing;
    if ('uppercase' in t && t.uppercase) style.textTransform = 'uppercase';
    return [name, style];
  }),
) as Record<TextVariant, TextStyle>;

export const textStyles = StyleSheet.create(resolved);
