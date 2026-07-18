import { Platform } from 'react-native';
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

export const fontMono = Platform.select({ ios: 'Menlo', default: 'monospace' });
