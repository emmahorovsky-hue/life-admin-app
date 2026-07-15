// "Filed paper" treatment shared across the Subscriptions cards, the Timeline
// sheet and the Dashboard renewals tile: a warm cream surface with a layered
// warm shadow and a soft-red left margin rule, so each surface reads as one
// filed statement. Defined once here so the surfaces can't drift apart.
//
// The surface fill and shadow are applied in CSS (`.paper-light` /
// `.dark .paper-light` in index.css) so dark mode can retune them — the tints
// below flow in as the `--paper-tint` custom property PaperSheet sets inline.
export const PAPER_TINTS = ['#fbf8f1', '#fdfbf6', '#f9f6ee', '#fcf9f2', '#faf7ef', '#fdfaf4'];
export const PAPER_TINT = PAPER_TINTS[0];
export const PAPER_MARGIN_RULE = 'hsl(2 65% 58% / 0.30)';
// Faint blue horizontal ruling, used by the Subscriptions cards only.
export const PAPER_RULING =
  'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, hsl(212 55% 55% / 0.10) 31px, hsl(212 55% 55% / 0.10) 32px)';
