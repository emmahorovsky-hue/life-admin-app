export const DOMAIN_ALIASES: Record<string, string> = {
  'disney+': 'disneyplus.com',
  'disney plus': 'disneyplus.com',
  'prime video': 'amazon.com',
  'amazon prime': 'amazon.com',
  'amazon prime video': 'amazon.com',
  icloud: 'apple.com',
  'icloud+': 'apple.com',
  'apple one': 'apple.com',
  'apple tv': 'apple.com',
  'apple tv+': 'apple.com',
  'apple music': 'apple.com',
  'youtube premium': 'youtube.com',
  'youtube music': 'youtube.com',
  'xbox game pass': 'xbox.com',
  'game pass': 'xbox.com',
  'playstation plus': 'playstation.com',
  'ps plus': 'playstation.com',
  'microsoft 365': 'microsoft.com',
  'office 365': 'microsoft.com',
  'adobe creative cloud': 'adobe.com',
  'creative cloud': 'adobe.com',
  'google one': 'google.com',
  'nintendo switch online': 'nintendo.com',
  // "chatgptplus.com" is someone else's site, and logo.dev serves its logo.
  chatgpt: 'chatgpt.com',
  'chatgpt plus': 'chatgpt.com',
  'chatgpt pro': 'chatgpt.com',
  'chatgpt team': 'chatgpt.com',
  openai: 'chatgpt.com',
  // GOMO by Singtel, not the unrelated gomo.com.
  gomo: 'gomo.sg',
};

/**
 * Pixel size requested from logo.dev for every logo, whatever size the tile is
 * drawn at. The largest tile is 44px; at 3x that is 132 device pixels, so 128
 * keeps it sharp. One size for every tile also means one URL per brand, which
 * the browser and React Native image caches reuse across screens.
 */
export const LOGO_FETCH_SIZE = 128;

/** Inset between a logo and its tile edge, as a fraction of the tile size. */
export const LOGO_INSET_RATIO = 0.14;

/**
 * The logo.dev image URL for a domain. `fallback=404` makes logo.dev 404 for
 * unknown domains (instead of a generated monogram), so the image's error
 * handler fires and the tile falls back to the category icon. The query string
 * is built by hand: React Native's URLSearchParams.toString() is not
 * implemented.
 */
export function logoUrl(domain: string, token: string): string {
  return `https://img.logo.dev/${domain}?token=${encodeURIComponent(token)}&size=${LOGO_FETCH_SIZE}&format=png&fallback=404`;
}

/** Inner padding, in px, for a logo tile drawn at `size` px. */
export function logoInset(size: number): number {
  return Math.round(size * LOGO_INSET_RATIO);
}

/**
 * Plan and tier words people add after a brand ("Netflix Premium", "GitHub
 * Pro"). They are not part of the brand's domain, so they are dropped before
 * guessing one: "netflixpremium.com" is someone else's site, and
 * "githubpro.com" has no logo at all.
 */
const PLAN_WORDS = new Set([
  'premium',
  'plus',
  'pro',
  'family',
  'ultimate',
  'storage',
  'basic',
  'standard',
  'student',
  'duo',
  'individual',
  'membership',
  'subscription',
]);

export function domainForName(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  const alias = DOMAIN_ALIASES[normalized];
  if (alias) return alias;

  // Strip trailing plan words one at a time, re-checking the aliases after
  // each so "iCloud Storage" reaches 'icloud' and "Xbox Game Pass Ultimate"
  // reaches 'xbox game pass'. The exact alias above always wins, so names that
  // are aliased whole ("disney plus") are untouched, and the last word is never
  // stripped, so a service actually called "Pro" keeps its name.
  const words = normalized.split(/\s+/);
  while (words.length > 1 && PLAN_WORDS.has(words[words.length - 1].replace(/[^a-z0-9]/g, ''))) {
    words.pop();
    const stripped = DOMAIN_ALIASES[words.join(' ')];
    if (stripped) return stripped;
  }

  const collapsed = words.join('').replace(/[^a-z0-9]/g, '');
  if (!collapsed) return null;

  return `${collapsed}.com`;
}
