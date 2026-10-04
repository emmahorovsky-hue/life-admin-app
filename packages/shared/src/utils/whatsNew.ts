// "What's new" decision logic (LIF-271). Pure, so it can be tested from the
// client's vitest suite; mobile/lib/whatsNew.ts owns the storage, the running
// version and the release notes themselves.

/**
 * Parse `x.y.z` into numbers. Missing parts count as 0 ("1.1" is 1.1.0); a
 * pre-release or build suffix is ignored ("1.2.0-beta.1" is 1.2.0). Returns
 * null for anything that is not a version at all.
 */
function parseVersion(version: string): [number, number, number] | null {
  const match = /^\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(version);
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

/**
 * Compare two versions numerically: negative when `a` is older, 0 when equal,
 * positive when `a` is newer. "1.10.0" is newer than "1.9.0".
 *
 * An unparseable version sorts as older than any real one. A corrupt stored
 * value then reads as "behind", so the current note still shows once, instead
 * of comparing as newer and hiding every note from then on.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return (pa ? 1 : 0) - (pb ? 1 : 0);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

export type WhatsNewAction = 'show' | 'baseline' | 'none';

export interface WhatsNewInput {
  /** The last version this user acknowledged, or null if nothing is stored. */
  stored: string | null;
  /** The running app version, or null if it cannot be read. */
  current: string | null;
  /** Whether the account holds any subscription, from the server. */
  hasSubscriptions: boolean;
  /** Whether a release note exists for `current`. */
  hasNote: boolean;
}

/**
 * What to do about the "What's new" sheet on this launch:
 * - `show`: present the note for the current version
 * - `baseline`: show nothing, but record the current version as seen
 * - `none`: show nothing and write nothing
 *
 * Nothing stored means one of two things, and the subscription count tells
 * them apart. An account with no subscriptions is a fresh install: first-run
 * setup is its welcome, so the version is recorded silently. If it weren't,
 * that user would finish setup and be told "what's new" on their next launch
 * about an app they had only just met. An account that already has
 * subscriptions was using the app before this feature existed (or before this
 * device), so it is treated as an upgrade.
 */
export function whatsNewAction({
  stored,
  current,
  hasSubscriptions,
  hasNote,
}: WhatsNewInput): WhatsNewAction {
  if (!current) return 'none';

  if (stored === null) {
    if (!hasSubscriptions) return 'baseline';
    return hasNote ? 'show' : 'baseline';
  }

  if (compareVersions(stored, current) < 0) {
    return hasNote ? 'show' : 'none';
  }
  return 'none';
}
