import prisma from '../utils/db';
import { sendRenewalReminders } from '../services/renewalReminderService';
import { computeNextRenewal } from '../utils/renewal';
import * as emailService from '../services/emailService';
import * as pushService from '../services/pushService';
import { emailFields } from '../utils/email';

// setup.ts mocks every sender, so no local override is needed here.
const mockSendRenewalReminderDigest = emailService.sendRenewalReminderDigest as jest.MockedFunction<typeof emailService.sendRenewalReminderDigest>;
// setup.ts mocks this module wholesale — the real one imports the pure-ESM
// expo-server-sdk, which jest cannot load. See the note there.
const mockSendRenewalPushDigest = pushService.sendRenewalPushDigest as jest.MockedFunction<typeof pushService.sendRenewalPushDigest>;

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date('2026-06-21T09:00:00.000Z');

function utcMidnight(daysFromNow: number): Date {
  return new Date(Date.UTC(2026, 5, 21) + daysFromNow * DAY_MS);
}

async function createUserAndSubscription({
  renewalDate,
  billingCycle = 'monthly',
  isActive = true,
  cancelledAt = null as Date | null,
  remindersMuted = false,
  reminderEmailsEnabled = true,
  emailVerified = true,
  reminderPushEnabled = true,
  deviceTokens = [] as string[],
  timezone = 'UTC',
}: {
  renewalDate: Date;
  billingCycle?: string;
  isActive?: boolean;
  cancelledAt?: Date | null;
  remindersMuted?: boolean;
  reminderEmailsEnabled?: boolean;
  emailVerified?: boolean;
  reminderPushEnabled?: boolean;
  // Empty by default so the existing email-only expectations keep holding:
  // reminderPushEnabled defaults to true in the schema, but a user with no
  // registered device has nowhere to push to.
  deviceTokens?: string[];
  // Matches the schema default. `now` in these tests is 09:00 UTC, which is
  // inside the delivery window for a UTC user, so the existing expectations
  // hold unchanged.
  timezone?: string;
}) {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  const user = await prisma.user.create({
    data: {
      ...emailFields(email),
      password: 'hashed-password',
      emailVerified,
      reminderEmailsEnabled,
      reminderPushEnabled,
      timezone,
      deviceTokens: {
        create: deviceTokens.map((token) => ({ token, platform: 'ios' })),
      },
    },
  });

  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      name: 'Test Subscription',
      cost: 9.99,
      currency: 'USD',
      billingCycle,
      renewalDate,
      category: 'streaming',
      isActive,
      cancelledAt,
      remindersMuted,
    },
  });

  return { user, subscription };
}

describe('sendRenewalReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends a reminder when a monthly subscription is within its 3-day window', async () => {
    const { subscription } = await createUserAndSubscription({ renewalDate: utcMidnight(3) });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(1);
    expect(result.email.skipped).toBe(0);
    expect(result.email.failed).toBe(0);
    expect(mockSendRenewalReminderDigest).toHaveBeenCalledTimes(1);
    expect(mockSendRenewalReminderDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ name: 'Test Subscription', daysUntil: 3 })],
      })
    );

    const log = await prisma.notificationLog.findFirst({ where: { subscriptionId: subscription.id } });
    expect(log).not.toBeNull();
    expect(log!.type).toBe('renewal_reminder');
    expect(log!.channel).toBe('email');
    expect(log!.status).toBe('sent');
    expect(log!.renewalDate).toEqual(utcMidnight(3));
  });

  it('skips a monthly subscription outside its cycle window (5 days out)', async () => {
    await createUserAndSubscription({ renewalDate: utcMidnight(5) });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(0);
    expect(mockSendRenewalReminderDigest).not.toHaveBeenCalled();
  });

  it('uses cycle-aware windows: weekly 1 day, quarterly 7, annual 14', async () => {
    // Each is exactly at its window edge — all due.
    await createUserAndSubscription({ renewalDate: utcMidnight(1), billingCycle: 'weekly' });
    await createUserAndSubscription({ renewalDate: utcMidnight(7), billingCycle: 'quarterly' });
    await createUserAndSubscription({ renewalDate: utcMidnight(14), billingCycle: 'annual' });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(3);
    expect(mockSendRenewalReminderDigest).toHaveBeenCalledTimes(3);
  });

  it('does not give a weekly subscription the long monthly notice (5 days out is not due)', async () => {
    await createUserAndSubscription({ renewalDate: utcMidnight(5), billingCycle: 'weekly' });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(0);
    expect(mockSendRenewalReminderDigest).not.toHaveBeenCalled();
  });

  it('derives the upcoming renewal from a past anchor date (monthly sub created long ago)', async () => {
    // Anchor ~6 months back, monthly cycle: next derived renewal is 2026-06-24 — inside the 3-day window.
    const anchor = new Date(Date.UTC(2025, 11, 24));
    await createUserAndSubscription({ renewalDate: anchor, billingCycle: 'monthly' });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(1);
    expect(mockSendRenewalReminderDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ renewalDate: computeNextRenewal(anchor, 'monthly', now) })],
      })
    );
  });

  it('skips when a reminder was already sent for this renewal occurrence', async () => {
    const { user, subscription } = await createUserAndSubscription({ renewalDate: utcMidnight(3) });

    await prisma.notificationLog.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        type: 'renewal_reminder',
        channel: 'email',
        status: 'sent',
        sentAt: new Date(now.getTime() - 1 * DAY_MS),
        renewalDate: utcMidnight(3),
      },
    });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(0);
    expect(result.email.skipped).toBe(1);
    expect(result.email.failed).toBe(0);
    expect(mockSendRenewalReminderDigest).not.toHaveBeenCalled();
  });

  it('sends again for the next cycle of a weekly subscription (dedup is per occurrence, not a rolling window)', async () => {
    // Weekly sub anchored 6 days ago: previous occurrence was -6d, next is +1d.
    const anchor = utcMidnight(-6);
    const { user, subscription } = await createUserAndSubscription({ renewalDate: anchor, billingCycle: 'weekly' });

    // Reminder for the PREVIOUS occurrence, sent a week ago — a rolling time
    // window would have treated it as a blocker.
    await prisma.notificationLog.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        type: 'renewal_reminder',
        channel: 'email',
        status: 'sent',
        sentAt: new Date(now.getTime() - 7 * DAY_MS),
        renewalDate: anchor,
      },
    });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(1);
    expect(result.email.skipped).toBe(0);
    expect(mockSendRenewalReminderDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [expect.objectContaining({ renewalDate: utcMidnight(1) })],
      })
    );
  });

  it('retries a send that failed on an earlier day', async () => {
    const { user, subscription } = await createUserAndSubscription({ renewalDate: utcMidnight(3) });

    await prisma.notificationLog.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        type: 'renewal_reminder',
        channel: 'email',
        status: 'failed',
        sentAt: new Date(now.getTime() - 1 * DAY_MS),
        renewalDate: utcMidnight(3),
      },
    });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(1);
    expect(result.email.skipped).toBe(0);
    expect(mockSendRenewalReminderDigest).toHaveBeenCalledTimes(1);
  });

  it('does not retry a send that failed earlier the same day', async () => {
    // Nothing here is transactional, so a send that threw may still have gone
    // out — Resend can time out after accepting the mail. With an hourly cron a
    // failure that retries immediately means a dozen of those a day, where the
    // old daily one cost at most one. Failures wait for tomorrow.
    const { user, subscription } = await createUserAndSubscription({ renewalDate: utcMidnight(3) });

    await prisma.notificationLog.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        type: 'renewal_reminder',
        channel: 'email',
        status: 'failed',
        sentAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        renewalDate: utcMidnight(3),
      },
    });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(0);
    expect(result.email.skipped).toBe(1);
    expect(mockSendRenewalReminderDigest).not.toHaveBeenCalled();
  });

  it('skips inactive subscriptions', async () => {
    await createUserAndSubscription({ renewalDate: utcMidnight(3), isActive: false });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(0);
    expect(result.email.skipped).toBe(0);
    expect(result.email.failed).toBe(0);
    expect(mockSendRenewalReminderDigest).not.toHaveBeenCalled();
  });

  it('skips cancelled subscriptions (no upcoming charge)', async () => {
    await createUserAndSubscription({
      renewalDate: utcMidnight(3),
      cancelledAt: new Date(now.getTime() - 3 * DAY_MS),
    });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(0);
    expect(mockSendRenewalReminderDigest).not.toHaveBeenCalled();
  });

  it('skips muted subscriptions', async () => {
    await createUserAndSubscription({ renewalDate: utcMidnight(3), remindersMuted: true });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(0);
    expect(mockSendRenewalReminderDigest).not.toHaveBeenCalled();
  });

  it('skips users who turned reminder emails off', async () => {
    await createUserAndSubscription({ renewalDate: utcMidnight(3), reminderEmailsEnabled: false });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(0);
    expect(mockSendRenewalReminderDigest).not.toHaveBeenCalled();
  });

  it('skips users with unverified email addresses', async () => {
    await createUserAndSubscription({ renewalDate: utcMidnight(3), emailVerified: false });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(0);
    expect(mockSendRenewalReminderDigest).not.toHaveBeenCalled();
  });

  it('bundles multiple due subscriptions for the same user into one digest email', async () => {
    const user = await prisma.user.create({
      data: { ...emailFields(`multi-${Date.now()}@example.com`), password: 'hashed', emailVerified: true },
    });

    await prisma.subscription.createMany({
      data: [
        { userId: user.id, name: 'Netflix', cost: 15, currency: 'USD', billingCycle: 'monthly', renewalDate: utcMidnight(3), category: 'streaming', isActive: true },
        { userId: user.id, name: 'Gym', cost: 40, currency: 'USD', billingCycle: 'weekly', renewalDate: utcMidnight(1), category: 'fitness', isActive: true },
      ],
    });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(2);
    expect(mockSendRenewalReminderDigest).toHaveBeenCalledTimes(1);
    const call = mockSendRenewalReminderDigest.mock.calls[0][0];
    expect(call.items).toHaveLength(2);
    expect(call.items.map((i) => i.name).sort()).toEqual(['Gym', 'Netflix']);

    const logs = await prisma.notificationLog.findMany({ where: { userId: user.id } });
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => l.status === 'sent' && l.channel === 'email')).toBe(true);
  });

  it('logs failed notifications and continues to other users when a digest send fails', async () => {
    const { subscription: sub1 } = await createUserAndSubscription({ renewalDate: utcMidnight(3) });
    const { subscription: sub2 } = await createUserAndSubscription({ renewalDate: utcMidnight(3) });

    mockSendRenewalReminderDigest
      .mockRejectedValueOnce(new Error('Resend API error'))
      .mockResolvedValueOnce({ id: 'ok' });

    const result = await sendRenewalReminders(now);

    expect(result.email.sent).toBe(1);
    expect(result.email.failed).toBe(1);

    const logs = await prisma.notificationLog.findMany({
      where: { subscriptionId: { in: [sub1.id, sub2.id] } },
    });
    expect(logs.map((l) => l.status).sort()).toEqual(['failed', 'sent']);
  });

  it('continues sending to remaining subscriptions when a log write fails', async () => {
    const { subscription: sub1 } = await createUserAndSubscription({ renewalDate: utcMidnight(3) });
    const { subscription: sub2 } = await createUserAndSubscription({ renewalDate: utcMidnight(3) });

    // First log write fails (transient DB error); subsequent calls go through.
    const createSpy = jest
      .spyOn(prisma.notificationLog, 'create')
      .mockRejectedValueOnce(new Error('db connection lost') as never);

    try {
      const result = await sendRenewalReminders(now);

      // Both digests still went out; the log failure is reported, not fatal.
      expect(result.email.sent).toBe(2);
      expect(mockSendRenewalReminderDigest).toHaveBeenCalledTimes(2);
    } finally {
      createSpy.mockRestore();
    }

    const logs = await prisma.notificationLog.findMany({
      where: { subscriptionId: { in: [sub1.id, sub2.id] } },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('sent');
  });

  describe('push channel', () => {
    const TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';

    // The channel ships dark behind ENABLE_PUSH_REMINDERS (see the note in
    // renewalReminderService). Everything below describes behaviour once the
    // rollout flag is on; the one case that asserts the gate itself clears it.
    const flagBefore = process.env.ENABLE_PUSH_REMINDERS;
    beforeAll(() => { process.env.ENABLE_PUSH_REMINDERS = 'true'; });
    afterAll(() => {
      if (flagBefore === undefined) delete process.env.ENABLE_PUSH_REMINDERS;
      else process.env.ENABLE_PUSH_REMINDERS = flagBefore;
    });

    it('sends nothing on the push channel while the rollout flag is off', async () => {
      delete process.env.ENABLE_PUSH_REMINDERS;
      try {
        await createUserAndSubscription({
          renewalDate: utcMidnight(3),
          deviceTokens: [TOKEN],
        });

        const result = await sendRenewalReminders(now);

        // The email is unaffected — the gate is on the push channel alone.
        expect(result.email.sent).toBe(1);
        expect(result.push.sent).toBe(0);
        expect(result.push.failed).toBe(0);
        expect(mockSendRenewalPushDigest).not.toHaveBeenCalled();

        // Nothing logged either, so turning the flag on later still delivers
        // this occurrence rather than finding it already deduped away.
        const logs = await prisma.notificationLog.findMany({ where: { channel: 'push' } });
        expect(logs).toHaveLength(0);
      } finally {
        process.env.ENABLE_PUSH_REMINDERS = 'true';
      }
    });

    it('sends a push alongside the email when both channels are on', async () => {
      const { subscription } = await createUserAndSubscription({
        renewalDate: utcMidnight(3),
        deviceTokens: [TOKEN],
      });

      const result = await sendRenewalReminders(now);

      expect(result.email.sent).toBe(1);
      expect(result.push.sent).toBe(1);
      expect(mockSendRenewalPushDigest).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: [TOKEN],
          items: [expect.objectContaining({ name: 'Test Subscription', daysUntil: 3 })],
        })
      );

      const logs = await prisma.notificationLog.findMany({ where: { subscriptionId: subscription.id } });
      expect(logs.map((l) => l.channel).sort()).toEqual(['email', 'push']);
      expect(logs.every((l) => l.status === 'sent')).toBe(true);
    });

    it('sends only email when the user turned push off', async () => {
      await createUserAndSubscription({
        renewalDate: utcMidnight(3),
        reminderPushEnabled: false,
        deviceTokens: [TOKEN],
      });

      const result = await sendRenewalReminders(now);

      expect(result.email.sent).toBe(1);
      expect(result.push.sent).toBe(0);
      expect(mockSendRenewalPushDigest).not.toHaveBeenCalled();
    });

    it('sends only push when the user turned reminder emails off', async () => {
      await createUserAndSubscription({
        renewalDate: utcMidnight(3),
        reminderEmailsEnabled: false,
        deviceTokens: [TOKEN],
      });

      const result = await sendRenewalReminders(now);

      expect(result.email.sent).toBe(0);
      expect(result.push.sent).toBe(1);
      expect(mockSendRenewalReminderDigest).not.toHaveBeenCalled();
      expect(mockSendRenewalPushDigest).toHaveBeenCalledTimes(1);
    });

    // The asymmetry that motivated splitting eligibility out of the SQL query:
    // email gates on a verified address, push does not — holding the device is
    // proof enough, and an unverified address must not silence the phone.
    it('pushes to an unverified user even though the email is withheld', async () => {
      await createUserAndSubscription({
        renewalDate: utcMidnight(3),
        emailVerified: false,
        deviceTokens: [TOKEN],
      });

      const result = await sendRenewalReminders(now);

      expect(result.email.sent).toBe(0);
      expect(result.push.sent).toBe(1);
      expect(mockSendRenewalReminderDigest).not.toHaveBeenCalled();
    });

    it('does not attempt a push for a user with no registered device', async () => {
      await createUserAndSubscription({ renewalDate: utcMidnight(3) });

      const result = await sendRenewalReminders(now);

      expect(result.push.sent).toBe(0);
      expect(result.push.failed).toBe(0);
      expect(mockSendRenewalPushDigest).not.toHaveBeenCalled();
    });

    it('dedups each channel independently: a sent push does not suppress the email', async () => {
      const { user, subscription } = await createUserAndSubscription({
        renewalDate: utcMidnight(3),
        deviceTokens: [TOKEN],
      });

      await prisma.notificationLog.create({
        data: {
          userId: user.id,
          subscriptionId: subscription.id,
          type: 'renewal_reminder',
          channel: 'push',
          status: 'sent',
          sentAt: new Date(now.getTime() - 1 * DAY_MS),
          renewalDate: utcMidnight(3),
        },
      });

      const result = await sendRenewalReminders(now);

      expect(result.push.sent).toBe(0);
      expect(result.push.skipped).toBe(1);
      expect(result.email.sent).toBe(1);
      expect(mockSendRenewalPushDigest).not.toHaveBeenCalled();
      expect(mockSendRenewalReminderDigest).toHaveBeenCalledTimes(1);
    });

    it('deletes device tokens Expo rejects as unregistered', async () => {
      const DEAD = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';
      const { user } = await createUserAndSubscription({
        renewalDate: utcMidnight(3),
        deviceTokens: [TOKEN, DEAD],
      });

      mockSendRenewalPushDigest.mockResolvedValueOnce({ invalidTokens: [DEAD], delivered: 1 });

      const result = await sendRenewalReminders(now);

      expect(result.push.sent).toBe(1);
      const remaining = await prisma.deviceToken.findMany({ where: { userId: user.id } });
      expect(remaining.map((t) => t.token)).toEqual([TOKEN]);
    });

    it('logs a failed push without affecting the email, so the next run retries it', async () => {
      const { subscription } = await createUserAndSubscription({
        renewalDate: utcMidnight(3),
        deviceTokens: [TOKEN],
      });

      mockSendRenewalPushDigest.mockRejectedValueOnce(new Error('Expo unreachable'));

      const result = await sendRenewalReminders(now);

      expect(result.push.failed).toBe(1);
      expect(result.email.sent).toBe(1);

      const logs = await prisma.notificationLog.findMany({ where: { subscriptionId: subscription.id } });
      const push = logs.find((l) => l.channel === 'push');
      expect(push!.status).toBe('failed');
      expect(logs.find((l) => l.channel === 'email')!.status).toBe('sent');

      // Not on the next hourly run, though — a failure is held for the rest of
      // the user's day, since the send may have landed despite throwing. No
      // mock is queued for this run because nothing should reach the sender.
      const sameDay = await sendRenewalReminders(new Date('2026-06-21T10:00:00.000Z'));
      expect(sameDay.push.sent).toBe(0);
      expect(sameDay.push.skipped).toBe(1);
      expect(mockSendRenewalPushDigest).toHaveBeenCalledTimes(1);

      // Tomorrow it retries: the subscription is still 2 days out, so it is the
      // same renewal occurrence and the same dedup key.
      mockSendRenewalPushDigest.mockResolvedValueOnce({ invalidTokens: [], delivered: 1 });
      const nextDay = await sendRenewalReminders(new Date('2026-06-22T09:00:00.000Z'));
      expect(nextDay.push.sent).toBe(1);
      expect(nextDay.email.sent).toBe(0); // already delivered, suppressed for good
    });

    it('records a failure when Expo accepts none of the tokens, and prunes them', async () => {
      const { user, subscription } = await createUserAndSubscription({
        renewalDate: utcMidnight(3),
        deviceTokens: [TOKEN],
      });

      // The device is gone: the only token comes back unregistered, so nothing
      // was delivered even though the request itself succeeded.
      mockSendRenewalPushDigest.mockResolvedValueOnce({ invalidTokens: [TOKEN], delivered: 0 });

      const result = await sendRenewalReminders(now);

      // Not `sent` — the log is the record of whether we warned this user.
      expect(result.push.sent).toBe(0);
      expect(result.push.failed).toBe(1);
      expect(result.email.sent).toBe(1);

      const logs = await prisma.notificationLog.findMany({ where: { subscriptionId: subscription.id } });
      expect(logs.find((l) => l.channel === 'push')!.status).toBe('failed');

      // Pruned regardless, so the user falls out of push eligibility next run
      // rather than retrying a dead token forever.
      const remaining = await prisma.deviceToken.findMany({ where: { userId: user.id } });
      expect(remaining).toHaveLength(0);
    });

    it('does not retry a pruned user on the next run (no tokens left to send to)', async () => {
      await createUserAndSubscription({
        renewalDate: utcMidnight(3),
        deviceTokens: [TOKEN],
      });

      mockSendRenewalPushDigest.mockResolvedValueOnce({ invalidTokens: [TOKEN], delivered: 0 });
      await sendRenewalReminders(now);

      const second = await sendRenewalReminders(now);
      expect(second.push.sent).toBe(0);
      expect(second.push.failed).toBe(0);
      expect(mockSendRenewalPushDigest).toHaveBeenCalledTimes(1);
    });

    it('bundles a user’s due subscriptions into one push', async () => {
      const user = await prisma.user.create({
        data: {
          ...emailFields(`push-multi-${Date.now()}@example.com`),
          password: 'hashed',
          emailVerified: true,
          deviceTokens: { create: [{ token: TOKEN, platform: 'ios' }] },
        },
      });

      await prisma.subscription.createMany({
        data: [
          { userId: user.id, name: 'Netflix', cost: 15, currency: 'USD', billingCycle: 'monthly', renewalDate: utcMidnight(3), category: 'streaming', isActive: true },
          { userId: user.id, name: 'Gym', cost: 40, currency: 'USD', billingCycle: 'weekly', renewalDate: utcMidnight(1), category: 'fitness', isActive: true },
        ],
      });

      const result = await sendRenewalReminders(now);

      expect(result.push.sent).toBe(2);
      expect(mockSendRenewalPushDigest).toHaveBeenCalledTimes(1);
      const call = mockSendRenewalPushDigest.mock.calls[0][0];
      expect(call.items.map((i) => i.name).sort()).toEqual(['Gym', 'Netflix']);
    });
  });

  // LIF-252. The job now runs hourly and each run delivers only to the users for
  // whom it is currently daytime. `now` throughout this file is 09:00 UTC.
  describe('local-time delivery', () => {
    it('delivers to a user for whom it is 09:00 local', async () => {
      await createUserAndSubscription({ renewalDate: utcMidnight(3), timezone: 'UTC' });

      const result = await sendRenewalReminders(now);

      expect(result.email.sent).toBe(1);
    });

    it('holds back a user for whom it is the middle of the night', async () => {
      // 09:00 UTC is 02:00 in Los Angeles — the case that made a daily 09:00 UTC
      // push unacceptable. The reminder is not lost, just not sent on this run.
      await createUserAndSubscription({
        renewalDate: utcMidnight(3),
        timezone: 'America/Los_Angeles',
      });

      const result = await sendRenewalReminders(now);

      expect(result.email.sent).toBe(0);
      expect(mockSendRenewalReminderDigest).not.toHaveBeenCalled();
    });

    it('delivers to that same user on the run that lands in their morning', async () => {
      // 17:00 UTC is 10:00 in Los Angeles.
      const { subscription } = await createUserAndSubscription({
        renewalDate: utcMidnight(3),
        timezone: 'America/Los_Angeles',
      });

      const result = await sendRenewalReminders(new Date('2026-06-21T17:00:00.000Z'));

      expect(result.email.sent).toBe(1);
      const log = await prisma.notificationLog.findFirst({ where: { subscriptionId: subscription.id } });
      expect(log!.status).toBe('sent');
    });

    it('holds back a user for whom it is late evening', async () => {
      // 09:00 UTC is 22:00 in Auckland — past the window's end, so it waits for
      // the morning rather than buzzing at bedtime.
      await createUserAndSubscription({
        renewalDate: utcMidnight(3),
        timezone: 'Pacific/Auckland',
      });

      const result = await sendRenewalReminders(now);

      expect(result.email.sent).toBe(0);
    });

    it('sends only once across the hours of a single local day', async () => {
      // The delivery window spans several hours so a missed run self-heals, and
      // per-occurrence dedup — not the schedule — is what keeps that to one
      // message. This also covers the repeated hour of a DST fall-back.
      await createUserAndSubscription({ renewalDate: utcMidnight(3), timezone: 'UTC' });

      const first = await sendRenewalReminders(new Date('2026-06-21T09:00:00.000Z'));
      const second = await sendRenewalReminders(new Date('2026-06-21T10:00:00.000Z'));
      const third = await sendRenewalReminders(new Date('2026-06-21T11:00:00.000Z'));

      expect(first.email.sent).toBe(1);
      expect(second.email.sent).toBe(0);
      expect(second.email.skipped).toBe(1);
      expect(third.email.skipped).toBe(1);
      expect(mockSendRenewalReminderDigest).toHaveBeenCalledTimes(1);
    });

    it('counts the days from the user\'s calendar day, not the server\'s', async () => {
      // 22:00 UTC on the 20th is already 10:00 on the 21st in Auckland (UTC+12
      // in June — the southern winter, so no DST). A renewal on the 24th is
      // 4 days out by the server's calendar but 3 by the user's — and 3 is both
      // what their calendar says and what puts it inside the monthly window at
      // all.
      await createUserAndSubscription({
        renewalDate: new Date(Date.UTC(2026, 5, 24)),
        timezone: 'Pacific/Auckland',
      });

      const result = await sendRenewalReminders(new Date('2026-06-20T22:00:00.000Z'));

      expect(result.email.sent).toBe(1);
      expect(mockSendRenewalReminderDigest).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [expect.objectContaining({ daysUntil: 3 })],
        })
      );
    });

    it('splits one run between users in different zones', async () => {
      // The production shape: a single run holds some users and delivers to
      // others. Grouping happens before the due filter, so a bug there would
      // leak one user's window decision onto another's subscriptions.
      const { user: awake } = await createUserAndSubscription({
        renewalDate: utcMidnight(3),
        timezone: 'UTC',
      });
      await createUserAndSubscription({
        renewalDate: utcMidnight(3),
        timezone: 'America/Los_Angeles',
      });

      const result = await sendRenewalReminders(now);

      expect(result.email.sent).toBe(1);
      expect(mockSendRenewalReminderDigest).toHaveBeenCalledTimes(1);
      expect(mockSendRenewalReminderDigest).toHaveBeenCalledWith(
        expect.objectContaining({ to: awake.email })
      );
    });

    it('delivers in the window\'s last hour and holds at its end', async () => {
      await createUserAndSubscription({ renewalDate: utcMidnight(3), timezone: 'UTC' });

      const lastHour = await sendRenewalReminders(new Date('2026-06-21T20:00:00.000Z'));
      expect(lastHour.email.sent).toBe(1);

      await createUserAndSubscription({ renewalDate: utcMidnight(3), timezone: 'UTC' });

      const past = await sendRenewalReminders(new Date('2026-06-21T21:00:00.000Z'));
      expect(past.email.sent).toBe(0);
    });

    it('treats an unrecognised timezone as UTC rather than dropping the user', async () => {
      await createUserAndSubscription({ renewalDate: utcMidnight(3), timezone: 'Mars/Olympus_Mons' });

      const result = await sendRenewalReminders(now);

      expect(result.email.sent).toBe(1);
    });
  });
});
