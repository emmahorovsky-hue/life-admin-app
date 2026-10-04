// "What's new" after an update (LIF-271): one sheet per app version, telling a
// returning user what changed. The decision itself (`whatsNewAction`) lives in
// @life-admin/shared so it can be unit-tested; this module owns the parts that
// need the device: the stored version, the running version and the notes.
//
// Stored **per account, not per device**, for the reason lib/onboarding.ts
// spells out (LIF-242): a device-wide key would let the first account on a
// phone acknowledge the note for every account after it, and a keychain item
// survives reinstalling the app. Logout leaves the value alone, so signing back
// in as the same user does not re-show a note they already read.
//
// Fresh installs show nothing. With no stored version and an empty account,
// the current version is recorded silently and first-run setup is the welcome:
// without that baseline, someone who has just finished setup would be told
// "what's new" on their next launch about an app they had only just met. No
// stored version on an account that *has* subscriptions is the opposite case,
// a user from before this feature (or before this device), so they get the
// note as an upgrade. That is why `getPendingNote` takes `hasSubscriptions`,
// and why the dashboard calls it as soon as that is known, before deciding
// whether setup goes up: the baseline has to be written even in a session the
// sheet will never be shown in.

import { DevSettings, type ImageSourcePropType } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import type { Href } from 'expo-router';
import { whatsNewAction, type IconName } from '@life-admin/shared';

export interface ReleaseNoteItem {
  id: string;
  title: string;
  body: string;
  icon: IconName;
  /** Single mode only: shown in the panel in place of the icon. */
  illustration?: ImageSourcePropType;
  /** Single mode only: replaces "Continue" and navigates on tap. */
  cta?: { label: string; route: Href };
}

export interface ReleaseNote {
  items: ReleaseNoteItem[];
}

export interface PendingNote {
  version: string;
  note: ReleaseNote;
}

/**
 * Keyed by the version the note describes. A version with no entry shows
 * nothing; an upgrade across several versions shows only the current one.
 */
export const RELEASE_NOTES: Record<string, ReleaseNote> = {
  // PLACEHOLDER COPY: replace with the real 1.1.0 release notes before shipping.
  '1.1.0': {
    items: [
      {
        id: 'email-forward',
        title: 'Forward bills by email',
        body: "Send a renewal or receipt email to your Paypr address and we'll add the subscription for you.",
        icon: 'mail',
      },
    ],
  },
};

// Underscore-separated like `first_run_setup_v1_` and `biometric_offered_`:
// SecureStore rejects colons, and both accessors here swallow errors, so a bad
// key would silently never persist and the sheet would reopen on every launch.
const SEEN_KEY_PREFIX = 'whats_new_seen_v1_';

/** Device-only, like the biometric flags: a note acknowledged on one phone
 *  says nothing about what this one has shown. */
const SEEN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function runningVersion(): string | null {
  return Constants.expoConfig?.version ?? null;
}

/**
 * The note to show this launch, or null. Writes the fresh-install baseline as a
 * side effect, which is why the dashboard calls this before it knows whether
 * the sheet may actually present. Any failure reads as "nothing to show": a
 * keychain error must not keep the dashboard from coming up.
 */
export async function getPendingNote(
  userId: string,
  hasSubscriptions: boolean,
): Promise<PendingNote | null> {
  try {
    const dev = __DEV__ ? await readDevPreview() : null;
    const current = dev?.version ?? runningVersion();
    const notes = dev ? DEV_NOTES : RELEASE_NOTES;
    const note = current ? notes[current] : undefined;
    const stored = await SecureStore.getItemAsync(SEEN_KEY_PREFIX + userId);

    const action = whatsNewAction({ stored, current, hasSubscriptions, hasNote: !!note });
    if (action === 'baseline') await markSeen(userId);
    return action === 'show' && current && note ? { version: current, note } : null;
  } catch {
    return null;
  }
}

/** Record the running version as acknowledged. Failure is not worth surfacing:
 *  the worst case is the note showing once more. */
export async function markSeen(userId: string): Promise<void> {
  try {
    const current = runningVersion();
    if (current) await SecureStore.setItemAsync(SEEN_KEY_PREFIX + userId, current, SEEN_OPTIONS);
    if (__DEV__) await SecureStore.deleteItemAsync(DEV_PREVIEW_KEY);
  } catch {
    /* no-op */
  }
}

// ── Development only ────────────────────────────────────────────────
// A simulator never "updates", so these fake one: rewind the stored version,
// point the running version at a sample note, and reload. The sheet then comes
// up through the dashboard's real gating, not a bypass. Nothing here runs in a
// release build: every entry point checks __DEV__.

export type WhatsNewPreview = 'single' | 'multi' | 'long';

const DEV_PREVIEW_KEY = 'whats_new_dev_preview';

const DEV_VERSIONS: Record<WhatsNewPreview, string> = {
  single: '1.1.0',
  multi: '9.0.0',
  long: '9.1.0',
};

const DEV_ITEMS: ReleaseNoteItem[] = [
  {
    id: 'dev-email',
    title: 'Forward bills by email',
    body: 'Send a renewal email to your Paypr address and we add the subscription.',
    icon: 'mail',
  },
  {
    id: 'dev-reminders',
    title: 'Reminders in your time zone',
    body: 'Renewal reminders now arrive during your day, wherever you are.',
    icon: 'bell',
  },
  {
    id: 'dev-scan',
    title: 'Sharper receipt scanning',
    body: 'Amounts and renewal dates are read more reliably from photos.',
    icon: 'scan',
  },
  {
    id: 'dev-calendar',
    title: 'Renewal calendar',
    body: 'See every upcoming charge laid out by month on the Timeline.',
    icon: 'calendar',
  },
  {
    id: 'dev-currency',
    title: 'Twenty currencies',
    body: 'Track subscriptions in PLN, AUD, CHF and seventeen more.',
    icon: 'card',
  },
];

const DEV_NOTES: Record<string, ReleaseNote> = {
  ...RELEASE_NOTES,
  [DEV_VERSIONS.multi]: { items: DEV_ITEMS.slice(0, 3) },
  [DEV_VERSIONS.long]: { items: DEV_ITEMS },
};

async function readDevPreview(): Promise<{ version: string } | null> {
  const mode = (await SecureStore.getItemAsync(DEV_PREVIEW_KEY)) as WhatsNewPreview | null;
  return mode && mode in DEV_VERSIONS ? { version: DEV_VERSIONS[mode] } : null;
}

/** __DEV__ only. Make the next launch look like an upgrade into a sample note,
 *  then reload so the dashboard runs its real gating from the start. */
export async function simulateWhatsNew(userId: string, mode: WhatsNewPreview): Promise<void> {
  if (!__DEV__) return;
  await SecureStore.setItemAsync(SEEN_KEY_PREFIX + userId, '0.0.0', SEEN_OPTIONS);
  await SecureStore.setItemAsync(DEV_PREVIEW_KEY, mode);
  DevSettings.reload();
}
