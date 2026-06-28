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
};

export function domainForName(name: string): string | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  const alias = DOMAIN_ALIASES[normalized];
  if (alias) return alias;

  const collapsed = normalized.replace(/[^a-z0-9]/g, '');
  if (!collapsed) return null;

  return `${collapsed}.com`;
}
