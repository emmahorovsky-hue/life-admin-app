/**
 * The one type scale for the marketing pages (`/`, `/mobile`, and the sections
 * they compose).
 *
 * ## Why this exists
 *
 * The two landing pages grew their own type systems: `/` sized headings with
 * Tailwind breakpoint classes (`text-3xl md:text-4xl`) while `/mobile` used
 * inline `clamp()` with hand-tuned `letterSpacing`. They drifted, and the drift
 * was visible — `/`'s 60px headline carried *no* letter-spacing while
 * `/mobile`'s 56px equivalent carried `-0.03em`, so the same brand set the same
 * optical size two different ways on two pages one click apart.
 *
 * ## The two rules the old scale broke
 *
 * 1. **Weight must taper as size drops.** Every style from 14px to 72px used to
 *    sit inside 700–900, which is no contrast at all: hierarchy came from size
 *    alone and every element shouted. Worse, Archivo's counters close up at 800,
 *    so an 18px heading at that weight read as a solid block. The ramp below is
 *    700 → 600 → 500 → 400, with a real step between neighbours.
 * 2. **Tracking is size-specific, never one value.** Large text needs negative
 *    tracking (letters read too far apart as they grow); small text wants ~0.
 *    `/` had it backwards in places — `-0.025em` on 14px labels.
 *
 * ## Using it
 *
 * Spread a role into `style`, and override `fontSize` where a particular use
 * wants a different size within the role. Weight, tracking and leading are the
 * part that must stay shared — those are what drifted:
 *
 * ```tsx
 * <h1 style={{ ...marketingType.display, fontSize: 'clamp(3rem, 6.4vw, 4.5rem)' }}>
 * ```
 *
 * Sizes are fluid `clamp()` rather than breakpoint jumps so both pages scale the
 * same way between the phone and desktop ends of the range.
 */

import type { CSSProperties } from 'react';

type Role =
  | 'display'
  | 'headline'
  | 'section'
  | 'cardTitle'
  | 'subtitle'
  | 'label'
  | 'stat'
  | 'body';

export const marketingType: Record<Role, CSSProperties> = {
  /** The page's one `<h1>`. 38 → 72px. */
  display: {
    fontSize: 'clamp(2.375rem, 6.2vw, 4.5rem)',
    fontWeight: 700,
    letterSpacing: '-0.035em',
    lineHeight: 0.98,
  },

  /** Big secondary display — closing CTAs, the pull-quote statement. 34 → 60px. */
  headline: {
    fontSize: 'clamp(2.125rem, 5.2vw, 3.75rem)',
    fontWeight: 700,
    letterSpacing: '-0.03em',
    lineHeight: 1,
  },

  /** Section `<h2>`. 30 → 44px. */
  section: {
    fontSize: 'clamp(1.875rem, 4.2vw, 2.75rem)',
    fontWeight: 600,
    letterSpacing: '-0.025em',
    lineHeight: 1.05,
  },

  /** Card and feature headings. 22 → 26px. */
  cardTitle: {
    fontSize: 'clamp(1.375rem, 2.2vw, 1.625rem)',
    fontWeight: 600,
    letterSpacing: '-0.015em',
    lineHeight: 1.2,
  },

  /** Small headings and ledes. 17 → 20px. */
  subtitle: {
    fontSize: 'clamp(1.0625rem, 1.6vw, 1.25rem)',
    fontWeight: 500,
    letterSpacing: '-0.01em',
    lineHeight: 1.3,
  },

  /**
   * Emphasis inside body copy — row names, inline labels. 14 → 16px.
   * Tracking is 0, not negative: this is the size where tightening starts to
   * cost legibility rather than buy it.
   */
  label: {
    fontWeight: 500,
    letterSpacing: 0,
    lineHeight: 1.4,
  },

  /**
   * Numerals in stat tiles. Keeps display weight — a lone figure has no word
   * shape to carry it, so it needs the mass that a heading gets from length.
   */
  stat: {
    fontWeight: 700,
    letterSpacing: '-0.03em',
    lineHeight: 1,
  },

  /** Running copy. Stated so a page never has to fall back to a bare default. */
  body: {
    fontWeight: 400,
    letterSpacing: 0,
    lineHeight: 1.55,
  },
};
