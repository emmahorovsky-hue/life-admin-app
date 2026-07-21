// ─────────────────────────────────────────────────────────────────────────────
// The "Quiet" layout language (LIF-211 Dashboard → LIF-213 across the tabs).
//
// The Dashboard 1b redesign established a spatial system — a 28pt content
// column, hairline rules instead of borders, 15pt row rhythm, warm-neutral
// supporting text, and brand orange spent on exactly one thing (the due-soon
// dot). These were literal numbers inside the Dashboard's StyleSheet; the other
// tabs each invented their own, so the app read as three designs.
//
// They live here so the tabs share one definition rather than three copies that
// drift. This module owns *structure* — spacing, rules, row rhythm, supporting
// text. It deliberately does not own figure typography: the Dashboard sets
// amounts in Archivo, while Subscriptions and Timeline keep Space Mono for
// tabular figures, which is the identity those list screens are meant to retain.
// ─────────────────────────────────────────────────────────────────────────────

import { StyleSheet } from 'react-native';
import { colors, fonts } from './theme';

/** Horizontal content column. Everything on a screen aligns to this. */
export const SCREEN_PAD = 28;

/** Vertical padding on a list row — the app's row rhythm. */
export const ROW_PAD_V = 15;

/** Logo size in list rows. Subscriptions is the inventory view, where logos
 *  earn their place; Dashboard and Timeline are dot-led renewal lists. */
export const ROW_LOGO = 36;

export const quiet = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  /** Screen header: quiet title left, contextual meta right. */
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: colors.foreground },
  headerMeta: { fontFamily: fonts.sans.regular, fontSize: 13, color: colors.softMuted },

  /** Sub-line under a screen title — counts, totals, context. */
  headerSub: {
    fontFamily: fonts.sans.regular,
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },

  /** Uppercase tracked section label. Replaces mono section headings. */
  eyebrow: {
    fontFamily: fonts.sans.semibold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.softMuted,
  },

  /** Primary rule — between major sections. */
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },

  /** List row: leading slot, flexible body, trailing figures. The gap suits a
   *  6px dot in the leading slot; logo-led rows widen it locally. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: ROW_PAD_V,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rowDivider,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: fonts.sans.medium, fontSize: 16, color: colors.foreground },
  rowMeta: {
    fontFamily: fonts.sans.regular,
    fontSize: 12,
    color: colors.softMuted,
    marginTop: 1,
  },
  rowRight: { alignItems: 'flex-end', flexShrink: 0 },

  /** The screen's one accent: something needs attention within 7 days. */
  dueDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: colors.brandOrange },
  dueSpacer: { width: 6, height: 6 },

  /** Inline empty / muted copy. */
  emptyText: {
    fontFamily: fonts.sans.regular,
    fontSize: 13,
    color: colors.softMuted,
    paddingVertical: ROW_PAD_V,
  },
});
