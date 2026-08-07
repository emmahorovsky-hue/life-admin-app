import Constants from 'expo-constants';
import { domainForName } from '@life-admin/shared';
import {
  IconStreaming,
  IconFitness,
  IconSoftware,
  IconMusic,
  IconCloud,
  IconGaming,
  IconProductivity,
  IconCard,
  type PayprIconComponent,
} from '../components/icons';

export function logoUrlForName(name: string): string | null {
  const token = Constants.expoConfig?.extra?.logoDevToken as string | undefined;
  if (!token) return null;

  const domain = domainForName(name);
  if (!domain) return null;

  // `fallback=404` makes logo.dev 404 for unknown domains (instead of a
  // generated monogram) so the Image onError fires and we fall back to the
  // category icon. Query string is built by hand — React Native's
  // URLSearchParams.toString() is not implemented.
  return `https://img.logo.dev/${domain}?token=${encodeURIComponent(token)}&size=64&format=png&fallback=404`;
}

// The same eight icons the web client maps (client/src/lib/subscriptionLogo.ts).
// Both platforms now draw from one shared geometry, so this is a true mirror
// rather than the closest-available lookalike the Ionicons set used to give.
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
