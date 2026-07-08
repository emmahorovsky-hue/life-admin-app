// "Filed paper" treatment shared across the Subscriptions cards, the Timeline
// sheet and the Dashboard renewals tile: a warm cream surface with a layered
// warm shadow and a soft-red left margin rule, so each surface reads as one
// filed statement. Defined once here so the surfaces can't drift apart.
export const PAPER_TINTS = ['#fbf8f1', '#fdfbf6', '#f9f6ee', '#fcf9f2', '#faf7ef', '#fdfaf4'];
export const PAPER_TINT = PAPER_TINTS[0];
export const PAPER_SHADOW =
  '0 1px 2px rgba(40,33,20,0.04), 0 4px 10px rgba(40,33,20,0.05), 0 12px 26px rgba(40,33,20,0.06)';
export const PAPER_MARGIN_RULE = 'hsl(2 65% 58% / 0.30)';
// Faint blue horizontal ruling, used by the Subscriptions cards only.
export const PAPER_RULING =
  'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, hsl(212 55% 55% / 0.10) 31px, hsl(212 55% 55% / 0.10) 32px)';
