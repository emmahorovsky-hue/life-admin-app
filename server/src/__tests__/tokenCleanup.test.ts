// LIF-151: the three token tables were never garbage-collected. The sweep must
// bound their growth WITHOUT breaking the consume paths, which distinguish a
// spent token ('already_used' / 'expired') from an unknown one ('invalid').

import crypto from 'crypto';
import prisma from '../utils/db';
import { deleteStaleTokens } from '../services/tokenCleanupService';

const DAY_MS = 24 * 60 * 60 * 1000;
const hash = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

describe('Stale token sweep (LIF-151)', () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: `tokensweep-${crypto.randomUUID()}@example.com`, password: 'x' },
    });
    userId = user.id;
  });

  const makeReset = (label: string, fields: { usedAt?: Date | null; expiresAt: Date }) =>
    prisma.passwordResetToken.create({
      data: { userId, tokenHash: hash(label + crypto.randomUUID()), ...fields },
    });

  it('deletes tokens that expired long before the cutoff', async () => {
    const old = await makeReset('old', { expiresAt: new Date(Date.now() - 40 * DAY_MS) });

    const swept = await deleteStaleTokens();

    expect(swept.passwordReset).toBe(1);
    expect(await prisma.passwordResetToken.findUnique({ where: { id: old.id } })).toBeNull();
  });

  it('deletes tokens consumed long before the cutoff', async () => {
    const old = await makeReset('used-old', {
      usedAt: new Date(Date.now() - 40 * DAY_MS),
      // Consumed tokens can still have a future expiry; the usedAt arm must catch them.
      expiresAt: new Date(Date.now() + DAY_MS),
    });

    const swept = await deleteStaleTokens();

    expect(swept.passwordReset).toBe(1);
    expect(await prisma.passwordResetToken.findUnique({ where: { id: old.id } })).toBeNull();
  });

  it('KEEPS a recently used token, so consume still reports "already_used"', async () => {
    // The load-bearing test. Purging spent rows on sight would collapse
    // 'already_used' and 'expired' into 'invalid' (see passwordResetService
    // consume: it branches on record.usedAt / record.expiresAt, and a deleted
    // row is indistinguishable from a token that never existed). A user clicking
    // a stale reset link would get "invalid token" instead of a real
    // explanation. The retention window exists precisely to prevent that.
    const recent = await makeReset('used-recent', {
      usedAt: new Date(Date.now() - 2 * DAY_MS),
      expiresAt: new Date(Date.now() - 1 * DAY_MS),
    });

    const swept = await deleteStaleTokens();

    expect(swept.passwordReset).toBe(0);
    expect(await prisma.passwordResetToken.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });

  it('never touches a live, unused token', async () => {
    const live = await makeReset('live', { expiresAt: new Date(Date.now() + DAY_MS) });

    const swept = await deleteStaleTokens();

    expect(swept.passwordReset).toBe(0);
    expect(await prisma.passwordResetToken.findUnique({ where: { id: live.id } })).not.toBeNull();
  });

  it('sweeps all three token tables', async () => {
    const expiresAt = new Date(Date.now() - 40 * DAY_MS);
    await prisma.emailVerificationToken.create({
      data: { userId, tokenHash: hash('v' + crypto.randomUUID()), email: 'a@b.c', expiresAt },
    });
    await prisma.passwordResetToken.create({
      data: { userId, tokenHash: hash('p' + crypto.randomUUID()), expiresAt },
    });
    await prisma.emailChangeToken.create({
      data: {
        userId,
        tokenHash: hash('e' + crypto.randomUUID()),
        newEmail: 'new@b.c',
        expiresAt,
      },
    });

    const swept = await deleteStaleTokens();

    expect(swept).toEqual({ emailVerification: 1, passwordReset: 1, emailChange: 1 });
  });

  it('honours TOKEN_RETENTION_DAYS', async () => {
    const previous = process.env.TOKEN_RETENTION_DAYS;
    process.env.TOKEN_RETENTION_DAYS = '1';
    try {
      // 2 days dead: retained under the 30d default, swept under a 1d window.
      const token = await makeReset('short', { expiresAt: new Date(Date.now() - 2 * DAY_MS) });

      const swept = await deleteStaleTokens();

      expect(swept.passwordReset).toBe(1);
      expect(await prisma.passwordResetToken.findUnique({ where: { id: token.id } })).toBeNull();
    } finally {
      if (previous === undefined) delete process.env.TOKEN_RETENTION_DAYS;
      else process.env.TOKEN_RETENTION_DAYS = previous;
    }
  });
});
