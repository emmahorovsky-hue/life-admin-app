import Constants from 'expo-constants';
import type { Ionicons } from '@expo/vector-icons';
import { domainForName } from '@life-admin/shared';

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

type IoniconName = keyof typeof Ionicons.glyphMap;

// Ionicons equivalents of the web's lucide category icons
// (client/src/lib/subscriptionLogo.ts) — lucide-react needs the DOM.
const CATEGORY_ICONS: Record<string, IoniconName> = {
  streaming: 'film-outline',
  fitness: 'barbell-outline',
  software: 'code-slash-outline',
  music: 'musical-notes-outline',
  cloud: 'cloud-outline',
  gaming: 'game-controller-outline',
  productivity: 'briefcase-outline',
  other: 'card-outline',
};

export function categoryIconFor(category: string): IoniconName {
  return CATEGORY_ICONS[category] ?? CATEGORY_ICONS.other;
}
