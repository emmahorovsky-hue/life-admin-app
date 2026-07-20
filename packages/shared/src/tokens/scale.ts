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
 * Semantic type scale (LIF-210). Every piece of mobile text picks a role here
 * rather than a raw `fontSize`, so sizes stay consistent screen-to-screen and
 * nothing body-like drops below the reading floor. Two families run in
 * parallel: Archivo (sans — reading/UI text) and Space Mono (the receipt
 * numbers, labels, and stamps). `mono: true` selects the mono family.
 *
 * `weight` uses CSS numeric weights; mobile maps them to concrete font families
 * (one family per weight in RN — see `textStyles` in mobile/lib/theme.ts). Web
 * can adopt the same role names later; today only mobile consumes these.
 *
 * Size ladder: 11 · 12 · 13 · 15 · 20 · 22 · 30. 11 is reserved for
 * mono (tracked labels / tabular meta); the smallest sans role is 12.
 */
export const typeScale = {
  // ── Sans (Archivo) ─────────────────────────────────────────────────────────
  /** Screen titles — "Dashboard" + brand-orange period. */
  pageTitle: { size: 30, weight: 700 },
  /** Sheet / dialog / drill-down header titles. */
  title: { size: 20, weight: 800 },
  /** Card titles and list-row primary names. */
  headline: { size: 15, weight: 700 },
  /** Default reading text. Weight overridable per use (medium/semibold). */
  body: { size: 15, weight: 400 },
  /** Secondary / muted supporting text, inline errors. */
  footnote: { size: 13, weight: 400 },
  /** Smallest sans role — chips, tiles, badges, footers. */
  caption: { size: 12, weight: 400 },

  // ── Mono (Space Mono) ──────────────────────────────────────────────────────
  /** Hero receipt figure — the big dashboard total. */
  monoStat: { size: 30, weight: 700, mono: true },
  /** Secondary receipt figures — per-tile / per-total numbers. */
  monoStatSm: { size: 22, weight: 700, mono: true },
  /** Tabular row data — names, costs, amounts in receipt rows. */
  monoData: { size: 13, weight: 700, mono: true },
  /** Uppercase tracked field labels and section headings. */
  monoLabel: { size: 11, weight: 400, mono: true, letterSpacing: 1.4, uppercase: true },
  /** Row meta — dates, relative times, stamps (plain, not uppercased). */
  monoMeta: { size: 11, weight: 400, mono: true },
} as const;
