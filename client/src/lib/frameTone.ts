/**
 * Tone values for the marketing pages' rails-and-registration-marks frame
 * (components/FrameMarks.tsx).
 *
 * `default` is the light paper surface `/` is drawn on and reads from the
 * semantic tokens. `inverse` is for a dark surface such as `/ios`, which is a
 * light-only route — `bg-foreground` there is the light palette's near-black
 * and would disappear against the page, so the inverse tone is literal snow
 * alphas instead.
 *
 * These live outside the component module so the rails (a plain CSS border on
 * the frame element) and the Rules crossing them share one definition: they
 * have to read as a single continuous grid, and a drift of even one alpha step
 * shows up as a seam.
 */

export type FrameTone = 'default' | 'inverse';

/** Tailwind class for the arms of a "+" mark. */
export const FRAME_ARM_CLASS: Record<FrameTone, string> = {
  default: 'bg-foreground/20',
  inverse: 'bg-[rgba(250,250,248,0.28)]',
};

/** Tailwind class for the hairline a Rule draws. */
export const FRAME_HAIRLINE_CLASS: Record<FrameTone, string> = {
  default: 'bg-border/50',
  inverse: 'bg-[rgba(250,250,248,0.10)]',
};

/** The same hairline as a CSS colour, for the frame's vertical rails. */
export const FRAME_HAIRLINE_COLOR: Record<FrameTone, string> = {
  default: 'hsl(var(--border) / 0.5)',
  inverse: 'rgba(250,250,248,0.10)',
};
