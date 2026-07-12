import prisma from '../utils/db';

// The three token tables index expiresAt but nothing ever deleted from them, so
// used and expired rows accumulated forever for every user who was not deleted
// by the unverified-account cleanup (LIF-151).
//
// Rows are NOT purged as soon as they die. The consume paths deliberately tell a
// dead token apart from an unknown one — passwordResetService.consume returns
// 'already_used' or 'expired' rather than 'invalid' — and the client turns that
// into a specific message ("this link has already been used"). Deleting a row
// the moment it is spent would collapse that back to a generic "invalid token"
// for anyone who clicks a stale link. So a row is only swept once it has been
// dead long enough that nobody is plausibly still clicking it.
//
// Tokens expire within 24h of issue, so 30 days is far beyond any realistic
// retry window while still bounding growth.
const DEFAULT_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const retentionDays = (): number => {
  const parsed = Number(process.env.TOKEN_RETENTION_DAYS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
};

export interface TokenCleanupResult {
  emailVerification: number;
  passwordReset: number;
  emailChange: number;
}

/**
 * Delete spent token rows — used or expired — that crossed the retention cutoff.
 * Live tokens, and dead ones still inside the window, are left alone.
 *
 * Returns the number of rows removed from each table.
 */
export async function deleteStaleTokens(now: Date = new Date()): Promise<TokenCleanupResult> {
  const cutoff = new Date(now.getTime() - retentionDays() * DAY_MS);

  // A row is stale if it was consumed before the cutoff, or expired before it.
  // `usedAt: { lt: cutoff }` also excludes NULLs, so unused-but-live tokens can
  // only match via the expiresAt arm — which is what we want.
  const where = {
    OR: [{ usedAt: { lt: cutoff } }, { expiresAt: { lt: cutoff } }],
  };

  const [emailVerification, passwordReset, emailChange] = await Promise.all([
    prisma.emailVerificationToken.deleteMany({ where }),
    prisma.passwordResetToken.deleteMany({ where }),
    prisma.emailChangeToken.deleteMany({ where }),
  ]);

  return {
    emailVerification: emailVerification.count,
    passwordReset: passwordReset.count,
    emailChange: emailChange.count,
  };
}
