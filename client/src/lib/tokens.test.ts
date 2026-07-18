import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lightColors, radius } from '@life-admin/shared';

// Drift guard (LIF-196): `client/src/index.css` stays the hand-authored source
// of the web theme, but its `:root` values must agree with the shared design
// tokens that mobile consumes. This test fails whenever either side changes
// without the other — update both together.
//
// Read via fs, not import: Vitest's CSS pipeline intercepts `.css` imports
// (even `?raw`) and returns an empty module. cwd is the client package root —
// where vitest.config lives — so the path is stable.
const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');

/** Extract `--var: value;` declarations from the given top-level block. */
function cssVars(selector: string): Record<string, string> {
  const block = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  if (!block) throw new Error(`No ${selector} block found in index.css`);
  const vars: Record<string, string> = {};
  for (const [, name, value] of block[1].matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    vars[name] = value.trim();
  }
  return vars;
}

const camelToKebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Exact sRGB render of an "H S% L%" triplet — same math browsers use. */
function hslToHex(triplet: string): string {
  const [h, s, l] = triplet.replace(/%/g, '').split(/\s+/).map(Number);
  const S = s / 100;
  const L = l / 100;
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = S * Math.min(L, 1 - L);
    const c = L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

describe('shared design tokens ↔ index.css :root', () => {
  const rootVars = cssVars(':root');
  // `white` is a mobile-only surface token, not a CSS var; `--radius` is
  // checked separately below.
  const colorTokens = Object.entries(lightColors).filter(([name]) => name !== 'white');

  it('every shared color token matches its :root var', () => {
    for (const [name, token] of colorTokens) {
      const cssName = camelToKebab(name);
      expect(rootVars[cssName], `--${cssName} missing from :root`).toBeDefined();
      expect(rootVars[cssName], `--${cssName} drifted from shared token "${name}"`).toBe(token.hsl);
    }
  });

  it('every :root color var has a shared token (no unshared additions)', () => {
    const tokenCssNames = new Set(colorTokens.map(([name]) => camelToKebab(name)));
    for (const cssName of Object.keys(rootVars)) {
      if (cssName === 'radius') continue;
      expect(tokenCssNames.has(cssName), `--${cssName} has no shared token — add it to packages/shared/src/tokens/colors.ts`).toBe(true);
    }
  });

  it('--radius matches the shared radius.base', () => {
    expect(rootVars['radius']).toBe(`${radius.base / 16}rem`);
  });

  it('token hex literals are the exact render of their hsl triplets', () => {
    for (const [name, token] of Object.entries(lightColors)) {
      expect(token.hex, `hex/hsl mismatch on token "${name}"`).toBe(hslToHex(token.hsl));
    }
  });
});
