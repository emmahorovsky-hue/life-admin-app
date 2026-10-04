import {
  IconProductivity,
  IconStreaming,
  IconCloud,
  IconSoftware,
  IconCard,
  IconFitness,
  IconGaming,
  IconMusic,
  type PayprIconComponent,
} from '@/components/icons';

export { domainForName, DOMAIN_ALIASES } from '@life-admin/shared';
import { domainForName, logoUrl } from '@life-admin/shared';

export function logoUrlForName(name: string): string | null {
  const token = import.meta.env.VITE_LOGO_DEV_TOKEN;
  if (!token) return null;

  const domain = domainForName(name);
  if (!domain) return null;

  return logoUrl(domain, token);
}

// Keys are the canonical category ids (packages/shared constants/subscriptions).
// The mobile app keeps a mirror of this map in mobile/lib/subscriptionLogo.ts.
const CATEGORY_ICONS: Record<string, PayprIconComponent> = {
  streaming: IconStreaming,
  fitness: IconFitness,
  software: IconSoftware,
  music: IconMusic,
  cloud: IconCloud,
  gaming: IconGaming,
  productivity: IconProductivity,
  other: IconCard,
};

export function categoryIconFor(category: string): PayprIconComponent {
  return CATEGORY_ICONS[category] ?? CATEGORY_ICONS.other;
}
