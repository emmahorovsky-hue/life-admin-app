import prisma from '../utils/db';
import { sendDeletionWarningEmail } from './emailService';

// How long an account may stay unverified before it is deleted.
const GRACE_PERIOD_DAYS = Number(process.env.GRACE_PERIOD_DAYS ?? 7);
// How long before the deadline the user is warned — also the minimum gap
// guaranteed between the warning email and the actual deletion.
const WARNING_LEAD_HOURS = Number(process.env.WARNING_LEAD_HOURS ?? 24);

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function loginUrl(): string {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  return `${clientUrl}/login`;
}

/**
 * Email unverified users whose grace period is about to expire, once each.
 *
 * Selection: unverified, not yet warned, and created at least
 * (GRACE_PERIOD - WARNING_LEAD) ago — i.e. within WARNING_LEAD of the deadline
 * (or already past it). Catching "already past" means pre-existing stale
 * accounts get a warning on the first run rather than being deleted outright.
 *
 * Returns the number of warning emails sent.
 */
export async function warnExpiringUnverifiedUsers(now: Date = new Date()): Promise<number> {
  const warnAfterMs = GRACE_PERIOD_DAYS * DAY_MS - WARNING_LEAD_HOURS * HOUR_MS;
  const createdBefore = new Date(now.getTime() - warnAfterMs);

  const users = await prisma.user.findMany({
    where: {
      emailVerified: false,
      deletionWarningSentAt: null,
      createdAt: { lte: createdBefore },
    },
    select: { id: true, email: true },
  });

  let sent = 0;
  for (const user of users) {
    try {
      await sendDeletionWarningEmail({
        to: user.email,
        deleteInHours: WARNING_LEAD_HOURS,
        loginUrl: loginUrl(),
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { deletionWarningSentAt: now },
      });
      sent++;
    } catch (err) {
      // Don't let one failed send abort the batch; leave deletionWarningSentAt
      // null so the user is retried on the next run.
      console.error(`Failed to send deletion warning to user ${user.id}:`, err);
    }
  }

  return sent;
}

/**
 * Hard-delete unverified users who were warned at least WARNING_LEAD_HOURS ago.
 * Gating on `deletionWarningSentAt` (not `createdAt`) guarantees every deleted
 * account got a warning email with at least WARNING_LEAD_HOURS to act.
 *
 * Subscriptions and EmailVerificationTokens are removed via onDelete: Cascade.
 *
 * Returns the number of accounts deleted.
 */
export async function deleteExpiredUnverifiedUsers(now: Date = new Date()): Promise<number> {
  const warnedBefore = new Date(now.getTime() - WARNING_LEAD_HOURS * HOUR_MS);

  const result = await prisma.user.deleteMany({
    where: {
      emailVerified: false,
      deletionWarningSentAt: { not: null, lte: warnedBefore },
    },
  });

  return result.count;
}

/**
 * Run the full unverified-account lifecycle: warn first, then delete. Warning
 * before deleting ensures no account is removed in the same pass it became
 * eligible.
 */
export async function runUnverifiedAccountCleanup(now: Date = new Date()): Promise<{ warned: number; deleted: number }> {
  const warned = await warnExpiringUnverifiedUsers(now);
  const deleted = await deleteExpiredUnverifiedUsers(now);
  return { warned, deleted };
}
