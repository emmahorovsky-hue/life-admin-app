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

export function domainForName(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  const alias = DOMAIN_ALIASES[normalized];
  if (alias) return alias;

  const collapsed = normalized.replace(/[^a-z0-9]/g, '');
  if (!collapsed) return null;

  return `${collapsed}.com`;
}
