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

export { domainForName, DOMAIN_ALIASES } from '@life-admin/shared';
import { domainForName } from '@life-admin/shared';

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
