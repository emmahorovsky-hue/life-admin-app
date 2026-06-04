import prisma from '../../utils/db';
import {
  warnExpiringUnverifiedUsers,
  deleteExpiredUnverifiedUsers,
  runUnverifiedAccountCleanup,
} from '../accountCleanupService';
import { sendDeletionWarningEmail } from '../emailService';

const warnMock = sendDeletionWarningEmail as jest.Mock;

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// Mirrors the service defaults (GRACE_PERIOD_DAYS=7, WARNING_LEAD_HOURS=24).
const GRACE_DAYS = 7;
const WARNING_LEAD_HOURS = 24;

interface UserOpts {
  email: string;
  emailVerified?: boolean;
  createdAt?: Date;
  deletionWarningSentAt?: Date | null;
}

async function createUser(opts: UserOpts) {
  return prisma.user.create({
    data: {
      email: opts.email,
      password: 'hashedpassword',
      emailVerified: opts.emailVerified ?? false,
      createdAt: opts.createdAt ?? new Date(),
      deletionWarningSentAt: opts.deletionWarningSentAt ?? null,
    },
  });
}

describe('accountCleanupService', () => {
  beforeEach(async () => {
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.user.deleteMany({});
    warnMock.mockClear();
  });

  afterEach(async () => {
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('warnExpiringUnverifiedUsers', () => {
    it('warns an unverified user within the warning window and stamps deletionWarningSentAt', async () => {
      const user = await createUser({
        email: 'expiring@example.com',
        createdAt: new Date(Date.now() - (GRACE_DAYS - 1) * DAY - HOUR), // just past the warn threshold
      });

      const warned = await warnExpiringUnverifiedUsers();

      expect(warned).toBe(1);
      expect(warnMock).toHaveBeenCalledTimes(1);
      expect(warnMock).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'expiring@example.com', deleteInHours: WARNING_LEAD_HOURS })
      );
      const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
      expect(refreshed?.deletionWarningSentAt).not.toBeNull();
    });

    it('warns pre-existing stale accounts (created well past the deadline) rather than skipping them', async () => {
      await createUser({
        email: 'ancient@example.com',
        createdAt: new Date(Date.now() - 30 * DAY),
      });

      const warned = await warnExpiringUnverifiedUsers();

      expect(warned).toBe(1);
      expect(warnMock).toHaveBeenCalledTimes(1);
    });

    it('does not warn recently-created unverified users', async () => {
      await createUser({
        email: 'fresh@example.com',
        createdAt: new Date(Date.now() - 1 * DAY),
      });

      const warned = await warnExpiringUnverifiedUsers();

      expect(warned).toBe(0);
      expect(warnMock).not.toHaveBeenCalled();
    });

    it('does not warn verified users', async () => {
      await createUser({
        email: 'verified@example.com',
        emailVerified: true,
        createdAt: new Date(Date.now() - 30 * DAY),
      });

      const warned = await warnExpiringUnverifiedUsers();

      expect(warned).toBe(0);
      expect(warnMock).not.toHaveBeenCalled();
    });

    it('is idempotent — does not re-warn an already-warned user', async () => {
      await createUser({
        email: 'alreadywarned@example.com',
        createdAt: new Date(Date.now() - 30 * DAY),
        deletionWarningSentAt: new Date(Date.now() - 2 * HOUR),
      });

      const warned = await warnExpiringUnverifiedUsers();

      expect(warned).toBe(0);
      expect(warnMock).not.toHaveBeenCalled();
    });

    it('leaves deletionWarningSentAt null when the email send fails (retried next run)', async () => {
      warnMock.mockRejectedValueOnce(new Error('resend down'));
      const user = await createUser({
        email: 'sendfail@example.com',
        createdAt: new Date(Date.now() - 30 * DAY),
      });

      const warned = await warnExpiringUnverifiedUsers();

      expect(warned).toBe(0);
      const refreshed = await prisma.user.findUnique({ where: { id: user.id } });
      expect(refreshed?.deletionWarningSentAt).toBeNull();
    });
  });

  describe('deleteExpiredUnverifiedUsers', () => {
    it('deletes unverified users warned more than the lead time ago', async () => {
      await createUser({
        email: 'todelete@example.com',
        createdAt: new Date(Date.now() - 30 * DAY),
        deletionWarningSentAt: new Date(Date.now() - (WARNING_LEAD_HOURS + 1) * HOUR),
      });

      const deleted = await deleteExpiredUnverifiedUsers();

      expect(deleted).toBe(1);
      expect(await prisma.user.count()).toBe(0);
    });

    it('does not delete users warned within the lead time', async () => {
      await createUser({
        email: 'recentlywarned@example.com',
        createdAt: new Date(Date.now() - 30 * DAY),
        deletionWarningSentAt: new Date(Date.now() - 1 * HOUR),
      });

      const deleted = await deleteExpiredUnverifiedUsers();

      expect(deleted).toBe(0);
      expect(await prisma.user.count()).toBe(1);
    });

    it('does not delete users who were never warned', async () => {
      await createUser({
        email: 'neverwarned@example.com',
        createdAt: new Date(Date.now() - 30 * DAY),
        deletionWarningSentAt: null,
      });

      const deleted = await deleteExpiredUnverifiedUsers();

      expect(deleted).toBe(0);
      expect(await prisma.user.count()).toBe(1);
    });

    it('does not delete verified users even if warned long ago', async () => {
      await createUser({
        email: 'verified2@example.com',
        emailVerified: true,
        createdAt: new Date(Date.now() - 30 * DAY),
        deletionWarningSentAt: new Date(Date.now() - 5 * DAY),
      });

      const deleted = await deleteExpiredUnverifiedUsers();

      expect(deleted).toBe(0);
      expect(await prisma.user.count()).toBe(1);
    });

    it('cascade-deletes the user\'s subscriptions and verification tokens', async () => {
      const user = await createUser({
        email: 'cascade@example.com',
        createdAt: new Date(Date.now() - 30 * DAY),
        deletionWarningSentAt: new Date(Date.now() - (WARNING_LEAD_HOURS + 1) * HOUR),
      });
      await prisma.subscription.create({
        data: {
          userId: user.id,
          name: 'Netflix',
          cost: '15.99',
          currency: 'USD',
          billingCycle: 'monthly',
          renewalDate: new Date(),
          category: 'streaming',
        },
      });
      await prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: 'deadbeef',
          email: user.email,
          expiresAt: new Date(Date.now() + DAY),
        },
      });

      const deleted = await deleteExpiredUnverifiedUsers();

      expect(deleted).toBe(1);
      expect(await prisma.subscription.count()).toBe(0);
      expect(await prisma.emailVerificationToken.count()).toBe(0);
    });
  });

  describe('runUnverifiedAccountCleanup', () => {
    it('does not delete a user in the same pass it is first warned', async () => {
      await createUser({
        email: 'firstpass@example.com',
        createdAt: new Date(Date.now() - 30 * DAY),
      });

      const { warned, deleted } = await runUnverifiedAccountCleanup();

      expect(warned).toBe(1);
      expect(deleted).toBe(0);
      expect(await prisma.user.count()).toBe(1);
    });
  });
});
