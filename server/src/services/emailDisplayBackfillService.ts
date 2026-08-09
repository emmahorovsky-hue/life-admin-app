import prisma from '../utils/db';
import { canonicalEmail, displayEmail } from '../utils/email';

/**
 * Repairs the display form of accounts whose address was flattened before the
 * display/identity split. `User.email` used to hold normalizeEmail()'s output,
 * so every Gmail user's dots were destroyed at write time — the original
 * spelling is not recoverable from the database and has to be supplied.
 *
 * This is a one-off ops job, not a scheduled one. See src/bin/restore-email-dots.ts.
 *
 * Two repairs live here and they write different columns in opposite
 * directions. Read which one you want before running either:
 *
 *   restoreEmailDisplayForms  takes an address from an operator, writes `email`
 *   repairCanonicalKeys       takes nothing, writes `emailCanonical` from `email`
 *
 * Running the first with input meant for the second reverts a confirmed email
 * change, which is why the runner refuses to accept addresses alongside
 * `--repair`.
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
 * it no longer displays.
 *
 * `repairCanonicalKeys` is what fixes what this reports. Do NOT hand the
 * reported addresses to `restoreEmailDisplayForms`: that job looks a row up by
 * canonical form and writes `email`, so feeding it the stale `emailCanonical`
 * finds the same row and overwrites the *new* address with the old one —
 * reverting a confirmed email change while reporting success.
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

export type CanonicalRepairOutcome =
  | { status: 'repaired'; userId: string; email: string; from: string; to: string }
  | { status: 'blocked'; userId: string; email: string; from: string; to: string; heldBy: string }
  | { status: 'skipped'; userId: string; email: string; reason: 'invalid_address' };

export interface CanonicalRepairResult {
  dryRun: boolean;
  outcomes: CanonicalRepairOutcome[];
}

/**
 * Repairs what `findInconsistentUsers` reports: rows where `email` moved to a
 * new address and `emailCanonical` stayed behind, so the account is reachable
 * only by an inbox its owner no longer uses.
 *
 * The direction is not arbitrary and is the opposite of the dots job's. The old
 * `verify-email-change` wrote normalizeEmail()'s output straight into `email`,
 * which means the *new* address is present, correct and already in canonical
 * form, while `emailCanonical` is the stale one. So `email` is the truth here
 * and the fix is `emailCanonical := canonicalEmail(email)`. Repairing in the
 * other direction — the shape `restoreEmailDisplayForms` has — would undo a
 * change the user confirmed by clicking a link in the new inbox.
 *
 * Opt-in for the same reason: this is the only path in the codebase that moves
 * an account's identity key, so it must be something an operator asks for by
 * name after reading a `--verify` report, never a side effect of another job.
 *
 * Collisions are refused per row rather than aborting the run. A collision means
 * two accounts claim one inbox, which is a merge decision for a human; the other
 * rows in the report are independent and there is no reason to leave them broken
 * while that gets sorted out. The caller is expected to treat any `blocked`
 * outcome as a failure — src/bin/restore-email-dots.ts exits non-zero on one.
 */
export async function repairCanonicalKeys(
  options: { dryRun?: boolean } = {},
): Promise<CanonicalRepairResult> {
  const dryRun = options.dryRun ?? false;
  const outcomes: CanonicalRepairOutcome[] = [];

  // Canonical values this run has already handed out. Without it a dry run over
  // two corrupted rows that both want the same key would report both as
  // repairable — the second one's conflict does not exist in the database yet,
  // because the first write is exactly what the dry run declined to make.
  const claimed = new Map<string, string>();

  for (const user of await findInconsistentUsers()) {
    if (!user.expected) {
      // Only reachable if `email` itself is unparseable, which no write path can
      // produce — every one of them goes through isEmail() first. Reported
      // rather than thrown so one impossible row cannot stop a real repair.
      outcomes.push({ status: 'skipped', userId: user.id, email: user.email, reason: 'invalid_address' });
      continue;
    }

    const target = user.expected;
    const blocked = (heldBy: string): void => {
      outcomes.push({
        status: 'blocked',
        userId: user.id,
        email: user.email,
        from: user.emailCanonical,
        to: target,
        heldBy,
      });
    };

    // A row can only appear once in the report, so anything already claiming
    // this key is another account. Refusing on the *current* holder is
    // deliberately conservative: if that holder is itself in the report and
    // about to move off the key, an operator only has to run the job twice.
    const holder =
      claimed.get(target) ??
      (await prisma.user.findUnique({ where: { emailCanonical: target }, select: { id: true } }))?.id;

    if (holder && holder !== user.id) {
      blocked(holder);
      continue;
    }

    if (!dryRun) {
      try {
        await prisma.user.update({ where: { id: user.id }, data: { emailCanonical: target } });
      } catch (err) {
        // The check above is not a lock — live traffic can take the key between
        // the read and the write. Reported like any other collision so a repair
        // that lost a race reads as a decision to make, not as a crash.
        if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
          const winner = await prisma.user.findUnique({
            where: { emailCanonical: target },
            select: { id: true },
          });
          blocked(winner?.id ?? 'unknown');
          continue;
        }
        throw err;
      }
    }

    claimed.set(target, user.id);
    outcomes.push({
      status: 'repaired',
      userId: user.id,
      email: user.email,
      from: user.emailCanonical,
      to: target,
    });
  }

  return { dryRun, outcomes };
}
