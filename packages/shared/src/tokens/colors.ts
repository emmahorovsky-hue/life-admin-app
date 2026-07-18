// Design tokens — light palette (LIF-196).
//
// Source of truth for design-token VALUES across web and mobile:
// - Web keeps `client/src/index.css` hand-authored; a drift test
//   (`client/src/lib/tokens.test.ts`) asserts its `:root` vars match the
//   `hsl` strings here, so the two can never silently disagree.
// - Mobile derives `mobile/lib/theme.ts` colors from the `hex` values here.
//
// Both formats are stored literally (no runtime conversion). The `hex` is the
// exact sRGB render of the `hsl` triplet — i.e. what a browser actually paints
// for `hsl(var(--x))` — not the original design hexes (#FAFAF8 Snow, #E53D00
// orange, …), which the CSS encoded with rounded HSL. The drift test also
// recomputes hex from hsl to guard internal consistency of these literals.
//
// Dark-mode tokens are deliberately web-only for now (mobile is light-only;
// dark mode on mobile is deferred — see LIF-186/189/194). When mobile grows a
// dark theme, add `darkColors` here and extend the drift test to `.dark`.

export interface ColorToken {
  /** Space-separated HSL triplet exactly as written in client/src/index.css (e.g. "16 100% 45%") */
  hsl: string;
  /** Exact sRGB render of `hsl`, for React Native consumption */
  hex: string;
}

export const lightColors = {
  background: { hsl: '60 17% 98%', hex: '#FBFBF9' }, // Snow
  foreground: { hsl: '0 0% 9%', hex: '#171717' }, // Ink
  card: { hsl: '60 17% 98%', hex: '#FBFBF9' },
  cardForeground: { hsl: '0 0% 9%', hex: '#171717' },
  popover: { hsl: '60 17% 98%', hex: '#FBFBF9' },
  popoverForeground: { hsl: '0 0% 9%', hex: '#171717' },
  primary: { hsl: '0 0% 9%', hex: '#171717' },
  primaryForeground: { hsl: '60 17% 98%', hex: '#FBFBF9' },
  primaryHover: { hsl: '0 0% 18%', hex: '#2E2E2E' },
  brandOrange: { hsl: '16 100% 45%', hex: '#E63D00' },
  secondary: { hsl: '35 26% 91%', hex: '#EEE9E2' }, // Sand
  secondaryForeground: { hsl: '0 0% 9%', hex: '#171717' },
  muted: { hsl: '35 26% 91%', hex: '#EEE9E2' },
  mutedForeground: { hsl: '36 5% 50%', hex: '#868179' },
  accent: { hsl: '35 26% 91%', hex: '#EEE9E2' },
  accentForeground: { hsl: '0 0% 9%', hex: '#171717' },
  destructive: { hsl: '16 100% 45%', hex: '#E63D00' },
  destructiveForeground: { hsl: '60 17% 98%', hex: '#FBFBF9' },
  border: { hsl: '36 9% 78%', hex: '#CCC8C2' }, // Ash
  input: { hsl: '36 9% 78%', hex: '#CCC8C2' },
  ring: { hsl: '16 100% 45%', hex: '#E63D00' },
  success: { hsl: '146 97% 38%', hex: '#03BF54' }, // #04F06A darkened for readability
  warning: { hsl: '40 90% 55%', hex: '#F4AF25' },
  // Not a CSS var (web uses bg-white utility); mobile uses it for card surfaces.
  white: { hsl: '0 0% 100%', hex: '#FFFFFF' },
} as const satisfies Record<string, ColorToken>;

export type LightColorName = keyof typeof lightColors;
