import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../utils/db';
import { sendEmailChangeVerificationEmail, sendEmailChangedNoticeEmail } from './emailService';
import { reportServerError } from '../utils/reportError';
import { canonicalEmail, displayEmail } from '../utils/email';

const TOKEN_BYTES = 32;
const EXPIRY_HOURS = 24;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function initiateEmailChange(userId: string, newEmail: string, platform?: string) {
  // Invalidate any prior pending email-change tokens for this user
  await prisma.emailChangeToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const raw = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.emailChangeToken.create({
    data: { userId, tokenHash, newEmail, expiresAt },
  });

  const verifyUrl = `${process.env.API_URL}/api/auth/verify-email-change?token=${raw}${platform === 'mobile' ? '&platform=mobile' : ''}`;
  await sendEmailChangeVerificationEmail({ to: newEmail, verifyUrl, expiresInHours: EXPIRY_HOURS });
}

type ConsumeResult =
  | { ok: true; userId: string; newEmail: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'already_used' | 'email_taken' };

export async function consumeEmailChangeToken(rawToken: string): Promise<ConsumeResult> {
  if (!rawToken || rawToken.length < 16) return { ok: false, reason: 'invalid' };

  const tokenHash = hashToken(rawToken);
  const record = await prisma.emailChangeToken.findUnique({ where: { tokenHash } });

  if (!record) return { ok: false, reason: 'invalid' };
  if (record.usedAt) return { ok: false, reason: 'already_used' };
  if (record.expiresAt < new Date()) return { ok: false, reason: 'expired' };

  // Derive both forms here rather than trusting the token row: the route
  // lowercases before the token is issued, but this service is also reachable
  // from jobs and tests that write EmailChangeToken directly, and a stray
  // uppercase would otherwise land in the display column, where every screen
  // shows it back to the user.
  const emailCanonical = canonicalEmail(record.newEmail);
  if (!emailCanonical) return { ok: false, reason: 'invalid' };
  const newEmail = displayEmail(record.newEmail);

  // The availability check at initiate-time can go stale: the token lives for 24h,
  // during which someone else may claim the address. Re-check here, and let the
  // unique constraint be the backstop against a concurrent claim (P2002).
  //
  // The self-check was already here and is now load-bearing: a dots-only change
  // resolves `taken` to this very user, and has to be allowed through.
  const taken = await prisma.user.findUnique({ where: { emailCanonical } });
  if (taken && taken.id !== record.userId) return { ok: false, reason: 'email_taken' };

  const oldEmail = (
    await prisma.user.findUnique({ where: { id: record.userId }, select: { email: true } })
  )?.email;

  const now = new Date();
  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        // The user proved control of the new inbox by clicking the link, so the
        // address is verified as of now. Both email columns move together —
        // writing one without the other leaves a row whose identity key no
        // longer matches its address, and the account becomes unreachable by
        // the address it displays.
        data: { email: newEmail, emailCanonical, emailVerified: true, emailVerifiedAt: now },
      }),
      prisma.emailChangeToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      }),
      prisma.emailChangeToken.updateMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
        data: { usedAt: now },
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, reason: 'email_taken' };
    }
    throw err;
  }

  // Notify the previous address so the real owner is alerted if the change was
  // not initiated by them. Failure here must not undo the completed change.
  if (oldEmail && oldEmail !== newEmail) {
    try {
      await sendEmailChangedNoticeEmail({ to: oldEmail, newEmail });
    } catch (err) {
      reportServerError('Failed to send email-change notice to previous address', err);
    }
  }

  return { ok: true, userId: record.userId, newEmail };
}
