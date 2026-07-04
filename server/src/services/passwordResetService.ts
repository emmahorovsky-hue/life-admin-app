import crypto from 'crypto';
import prisma from '../utils/db';
import { sendPasswordResetEmail } from './emailService';

const TOKEN_BYTES = 32;
const EXPIRY_HOURS = 1;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function issuePasswordResetToken(userId: string, email: string, platform?: string): Promise<void> {
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const raw = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const mobileUrl = process.env.MOBILE_URL || 'lifeadmin://';
  const resetUrl = platform === 'mobile'
    ? `${mobileUrl}reset-password?token=${raw}`
    : `${clientUrl}/reset-password?token=${raw}`;
  await sendPasswordResetEmail({ to: email, resetUrl, expiresInHours: EXPIRY_HOURS });
}

type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'already_used' };

export async function consumePasswordResetToken(rawToken: string): Promise<ConsumeResult> {
  if (!rawToken || rawToken.length < 16) return { ok: false, reason: 'invalid' };

  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record) return { ok: false, reason: 'invalid' };
  if (record.usedAt) return { ok: false, reason: 'already_used' };
  if (record.expiresAt < new Date()) return { ok: false, reason: 'expired' };

  // Atomically claim the token so two concurrent requests with the same valid
  // token can't both succeed. Only the request whose updateMany flips usedAt
  // (count === 1) is allowed to proceed; a loser sees count === 0. The WHERE
  // re-checks usedAt/expiresAt inside the same write to close the read→write gap.
  const claim = await prisma.passwordResetToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });

  if (claim.count === 0) return { ok: false, reason: 'already_used' };

  return { ok: true, userId: record.userId };
}
