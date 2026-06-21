import crypto from 'crypto';
import prisma from '../utils/db';
import { sendEmailChangeVerificationEmail } from './emailService';

const TOKEN_BYTES = 32;
const EXPIRY_HOURS = 24;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function initiateEmailChange(userId: string, newEmail: string) {
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

  const verifyUrl = `${process.env.API_URL}/api/auth/verify-email-change?token=${raw}`;
  await sendEmailChangeVerificationEmail({ to: newEmail, verifyUrl, expiresInHours: EXPIRY_HOURS });
}

type ConsumeResult =
  | { ok: true; userId: string; newEmail: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'already_used' };

export async function consumeEmailChangeToken(rawToken: string): Promise<ConsumeResult> {
  if (!rawToken || rawToken.length < 16) return { ok: false, reason: 'invalid' };

  const tokenHash = hashToken(rawToken);
  const record = await prisma.emailChangeToken.findUnique({ where: { tokenHash } });

  if (!record) return { ok: false, reason: 'invalid' };
  if (record.usedAt) return { ok: false, reason: 'already_used' };
  if (record.expiresAt < new Date()) return { ok: false, reason: 'expired' };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { email: record.newEmail },
    }),
    prisma.emailChangeToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.emailChangeToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true, userId: record.userId, newEmail: record.newEmail };
}
