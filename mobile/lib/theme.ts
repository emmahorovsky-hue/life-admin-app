import { lightColors } from '@life-admin/shared';

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
