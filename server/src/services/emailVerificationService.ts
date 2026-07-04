import crypto from 'crypto';
import prisma from '../utils/db';
import { sendVerificationEmail } from './emailService'; // from LIF-42

const TOKEN_BYTES = 32;
const EXPIRY_HOURS = 24;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function issueEmailVerificationToken(userId: string, email: string, platform?: string) {
  // Invalidate prior unused tokens (keeps inbox clean & prevents token farming)
  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const raw = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash, email, expiresAt },
  });

  const verifyUrl = `${process.env.API_URL}/api/auth/verify-email?token=${raw}${platform === 'mobile' ? '&platform=mobile' : ''}`;
  await sendVerificationEmail({ to: email, verifyUrl, expiresInHours: EXPIRY_HOURS });
}

type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'already_used' | 'email_changed' };

export async function consumeEmailVerificationToken(rawToken: string): Promise<ConsumeResult> {
  if (!rawToken || rawToken.length < 16) return { ok: false, reason: 'invalid' };

  const tokenHash = hashToken(rawToken);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) return { ok: false, reason: 'invalid' };
  if (record.usedAt) return { ok: false, reason: 'already_used' };
  if (record.expiresAt < new Date()) return { ok: false, reason: 'expired' };
  if (record.email !== record.user.email) return { ok: false, reason: 'email_changed' };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.emailVerificationToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true, userId: record.userId };
}