// Design tokens — non-color scales (LIF-196). Values are unitless numbers;
// web reads them as px-equivalents (`--radius: 0.125rem` = radius.base px at
// the 16px root), mobile passes them straight to StyleSheet.
//
// Font FAMILY names are intentionally absent: CSS family names ("Space Mono")
// and the React Native loaded-font names ("SpaceMono_400Regular") differ per
// platform, so families live in each app's own theme.

/** Near-square receipt corners: base for cards/buttons/inputs, sm for knobs. */
export const radius = {
  base: 2,
  sm: 1,
} as const;

/** Weight of perforation/dotted rules and emphasized borders (px). */
export const hairline = 1.5;

/** Spacing steps used by both platforms (px). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/**
 * Type scale for the conventions the design wave shipped. `weight` uses CSS
 * numeric weights; mobile maps them to concrete font families (one family per
 * weight in RN).
 */
export const typeScale = {
  /** Page titles — "Settings" + brand-orange period. */
  pageTitle: { size: 30, weight: 700 },
  /** Dialog / drill-down header titles. */
  dialogTitle: { size: 18, weight: 800 },
  /** Monospace uppercase field labels. */
  monoLabel: { size: 11, letterSpacing: 1.4, weight: 400 },
} as const;
