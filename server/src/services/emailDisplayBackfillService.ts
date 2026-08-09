import prisma from '../utils/db';
import { canonicalEmail, displayEmail } from '../utils/email';

/**
 * Repairs the display form of accounts whose address was flattened before the
 * display/identity split. `User.email` used to hold normalizeEmail()'s output,
 * so every Gmail user's dots were destroyed at write time — the original
 * spelling is not recoverable from the database and has to be supplied.
 *
 * This is a one-off ops job, not a scheduled one. See src/bin/restore-email-dots.ts.
 */

export type BackfillOutcome =
  | { status: 'applied'; userId: string; from: string; to: string }
  | { status: 'unchanged'; userId: string; email: string }
  | { status: 'skipped'; input: string; reason: 'invalid_address' | 'no_such_account' | 'display_taken' };

export interface BackfillResult {
  dryRun: boolean;
  outcomes: BackfillOutcome[];
}

/**
 * SAFETY PROPERTY: an address is only applied to the account its *canonical*
 * form already identifies. The row is looked up BY that canonical value and the
 * job never writes `emailCanonical`, so it cannot point an account at a
 * different inbox, create an account, or merge two. The worst a typo can do is
 * match nothing.
 *
 * Idempotent: an address already in its target form reports `unchanged`.
 */
export async function restoreEmailDisplayForms(
  addresses: string[],
  options: { dryRun?: boolean } = {},
): Promise<BackfillResult> {
  const dryRun = options.dryRun ?? false;
  const outcomes: BackfillOutcome[] = [];

  for (const input of addresses) {
    const display = displayEmail(input);
    const canonical = canonicalEmail(display);

    if (!canonical) {
      outcomes.push({ status: 'skipped', input, reason: 'invalid_address' });
      continue;
    }

    const user = await prisma.user.findUnique({
      where: { emailCanonical: canonical },
      select: { id: true, email: true, emailCanonical: true },
    });

    if (!user) {
      outcomes.push({ status: 'skipped', input, reason: 'no_such_account' });
      continue;
    }

    if (user.email === display) {
      outcomes.push({ status: 'unchanged', userId: user.id, email: user.email });
      continue;
    }

    // Holds by construction — the row was found by this exact value. Asserted
    // anyway so a future refactor of the lookup can't quietly turn this job
    // into one that repoints accounts.
    if (user.emailCanonical !== canonical) {
      throw new Error(
        `Refusing to write: ${input} canonicalizes to ${canonical}, but the matched row holds ${user.emailCanonical}`,
      );
    }

    if (dryRun) {
      outcomes.push({ status: 'applied', userId: user.id, from: user.email, to: display });
      continue;
    }

    try {
      // `email` only. The identity key must not move: the account is reachable
      // by every spelling of this inbox before and after.
      await prisma.user.update({ where: { id: user.id }, data: { email: display } });
      outcomes.push({ status: 'applied', userId: user.id, from: user.email, to: display });
    } catch (err) {
      if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
        outcomes.push({ status: 'skipped', input, reason: 'display_taken' });
        continue;
      }
      throw err;
    }
  }

  return { dryRun, outcomes };
}

/**
 * Read-only audit for rows whose two email columns disagree — i.e. some write
 * path set one without the other.
 *
 * Worth running right after a deploy of this change: between the migration
 * landing and the new code taking traffic, the old `verify-email-change` could
 * still update `email` alone, leaving an account reachable only by the address
 * it no longer displays. A non-empty result is repairable, because the old code
 * wrote the canonical form into `email`.
 */
export async function findInconsistentUsers(): Promise<
  { id: string; email: string; emailCanonical: string; expected: string | null }[]
> {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, emailCanonical: true },
  });

  return users
    .map((u) => ({ ...u, expected: canonicalEmail(u.email) }))
    .filter((u) => u.expected !== u.emailCanonical);
}
