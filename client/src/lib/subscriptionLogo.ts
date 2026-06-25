import {
  Briefcase,
  Clapperboard,
  Cloud,
  Code,
  CreditCard,
  Dumbbell,
  Gamepad2,
  Music,
  type LucideIcon,
} from 'lucide-react';

// Brand logos are derived from the free-text subscription name at render time
// (no domain/website is stored). We normalize the name to a best-guess domain
// and request it from logo.dev. A publishable token is required; when it's
// absent the helper returns null and the UI falls back to the category icon.

// Common multi-word / non-".com" brands whose domain can't be inferred by the
// generic "<collapsed-name>.com" rule. Keys are normalized (lowercase, trimmed).
const DOMAIN_ALIASES: Record<string, string> = {
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
};

/**
 * Best-guess domain for a brand name, or null if the name is empty.
 * Checks the alias map first, then collapses the name to "<alnum>.com".
 */
export function domainForName(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  const alias = DOMAIN_ALIASES[normalized];
  if (alias) return alias;

  const collapsed = normalized.replace(/[^a-z0-9]/g, '');
  if (!collapsed) return null;

  return `${collapsed}.com`;
}

/**
 * logo.dev image URL for a subscription name, or null when no logo can be
 * requested (missing token or unresolvable name). The token is a client-side
 * publishable key, safe to expose.
 */
export function logoUrlForName(name: string): string | null {
  const token = import.meta.env.VITE_LOGO_DEV_TOKEN;
  if (!token) return null;

  const domain = domainForName(name);
  if (!domain) return null;

  // `fallback=404` makes logo.dev return a 404 (not a generated monogram) for
  // domains it doesn't recognize, so the <img> onError fires and the row falls
  // back to the category icon instead of showing a generic letter placeholder.
  const params = new URLSearchParams({
    token,
    size: '64',
    format: 'png',
    fallback: '404',
  });
  return `https://img.logo.dev/${domain}?${params.toString()}`;
}

// Fallback icon shown when no brand logo is available — keyed off the 8
// category ids in subscriptions.ts. `other` doubles as the default.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  streaming: Clapperboard,
  fitness: Dumbbell,
  software: Code,
  music: Music,
  cloud: Cloud,
  gaming: Gamepad2,
  productivity: Briefcase,
  other: CreditCard,
};

export function categoryIconFor(category: string): LucideIcon {
  return CATEGORY_ICONS[category] ?? CATEGORY_ICONS.other;
}
