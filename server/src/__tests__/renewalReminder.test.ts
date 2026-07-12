import prisma from '../utils/db';
import { sendRenewalReminders } from '../services/renewalReminderService';
import { computeNextRenewal } from '../utils/renewal';
import * as emailService from '../services/emailService';

// setup.ts mocks every sender, so no local override is needed here.
const mockSendRenewalReminderEmail = emailService.sendRenewalReminderEmail as jest.MockedFunction<typeof emailService.sendRenewalReminderEmail>;

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
}: {
  renewalDate: Date;
  billingCycle?: string;
  isActive?: boolean;
  cancelledAt?: Date | null;
}) {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

  const user = await prisma.user.create({
    data: {
      email,
      password: 'hashed-password',
      emailVerified: true,
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
    },
  });

  return { user, subscription };
}

describe('sendRenewalReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends a reminder when subscription renews within the window', async () => {
    const { subscription } = await createUserAndSubscription({ renewalDate: utcMidnight(5) });

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockSendRenewalReminderEmail).toHaveBeenCalledTimes(1);
    expect(mockSendRenewalReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionName: 'Test Subscription' })
    );

    const log = await prisma.notificationLog.findFirst({ where: { subscriptionId: subscription.id } });
    expect(log).not.toBeNull();
    expect(log!.type).toBe('renewal_reminder');
    expect(log!.status).toBe('sent');
    expect(log!.renewalDate).toEqual(utcMidnight(5));
  });

  it('derives the upcoming renewal from a past anchor date (monthly sub created long ago)', async () => {
    // Anchor ~6 months back, monthly cycle: next derived renewal is 2026-06-26 — inside the window.
    const anchor = new Date(Date.UTC(2025, 11, 26));
    await createUserAndSubscription({ renewalDate: anchor, billingCycle: 'monthly' });

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(1);
    expect(mockSendRenewalReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ renewalDate: computeNextRenewal(anchor, 'monthly', now) })
    );
  });

  it('skips when a reminder was already sent for this renewal occurrence', async () => {
    const { user, subscription } = await createUserAndSubscription({ renewalDate: utcMidnight(5) });

    await prisma.notificationLog.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        type: 'renewal_reminder',
        status: 'sent',
        sentAt: new Date(now.getTime() - 1 * DAY_MS),
        renewalDate: utcMidnight(5),
      },
    });

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockSendRenewalReminderEmail).not.toHaveBeenCalled();
  });

  it('sends again for the next cycle of a weekly subscription (dedup is per occurrence, not a rolling window)', async () => {
    // Weekly sub anchored 2 days ago: previous occurrence was -2d, next is +5d.
    const anchor = utcMidnight(-2);
    const { user, subscription } = await createUserAndSubscription({ renewalDate: anchor, billingCycle: 'weekly' });

    // Reminder for the PREVIOUS occurrence, sent 6 days ago — inside what the old
    // rolling 8-day window would have treated as a blocker.
    await prisma.notificationLog.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        type: 'renewal_reminder',
        status: 'sent',
        sentAt: new Date(now.getTime() - 6 * DAY_MS),
        renewalDate: anchor,
      },
    });

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockSendRenewalReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ renewalDate: utcMidnight(5) })
    );
  });

  it('retries after a failed send (failed logs do not dedup)', async () => {
    const { user, subscription } = await createUserAndSubscription({ renewalDate: utcMidnight(5) });

    await prisma.notificationLog.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        type: 'renewal_reminder',
        status: 'failed',
        sentAt: new Date(now.getTime() - 1 * DAY_MS),
        renewalDate: utcMidnight(5),
      },
    });

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockSendRenewalReminderEmail).toHaveBeenCalledTimes(1);
  });

  it('skips inactive subscriptions', async () => {
    await createUserAndSubscription({ renewalDate: utcMidnight(5), isActive: false });

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockSendRenewalReminderEmail).not.toHaveBeenCalled();
  });

  it('skips cancelled subscriptions (no upcoming charge)', async () => {
    await createUserAndSubscription({
      renewalDate: utcMidnight(5),
      cancelledAt: new Date(now.getTime() - 3 * DAY_MS),
    });

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(0);
    expect(mockSendRenewalReminderEmail).not.toHaveBeenCalled();
  });

  it('skips subscriptions renewing beyond the reminder window', async () => {
    await createUserAndSubscription({ renewalDate: utcMidnight(10) }); // default window is 7 days

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(0);
    expect(mockSendRenewalReminderEmail).not.toHaveBeenCalled();
  });

  it('logs a failed notification and continues when email send fails', async () => {
    const { subscription: sub1 } = await createUserAndSubscription({ renewalDate: utcMidnight(3) });
    const { subscription: sub2 } = await createUserAndSubscription({ renewalDate: utcMidnight(5) });

    mockSendRenewalReminderEmail
      .mockRejectedValueOnce(new Error('Resend API error'))
      .mockResolvedValueOnce({ id: 'ok' });

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);

    const logs = await prisma.notificationLog.findMany({
      where: { subscriptionId: { in: [sub1.id, sub2.id] } },
    });
    expect(logs.map((l) => l.status).sort()).toEqual(['failed', 'sent']);
  });

  it('continues sending to remaining subscriptions when a log write fails', async () => {
    const { subscription: sub1 } = await createUserAndSubscription({ renewalDate: utcMidnight(3) });
    const { subscription: sub2 } = await createUserAndSubscription({ renewalDate: utcMidnight(5) });

    // First log write fails (transient DB error); subsequent calls go through.
    const createSpy = jest
      .spyOn(prisma.notificationLog, 'create')
      .mockRejectedValueOnce(new Error('db connection lost') as never);

    try {
      const result = await sendRenewalReminders(now);

      // Both emails still went out; the log failure is reported, not fatal.
      expect(result.sent).toBe(2);
      expect(mockSendRenewalReminderEmail).toHaveBeenCalledTimes(2);
    } finally {
      createSpy.mockRestore();
    }

    const logs = await prisma.notificationLog.findMany({
      where: { subscriptionId: { in: [sub1.id, sub2.id] } },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('sent');
  });

  it('sends separate reminders for multiple subscriptions belonging to the same user', async () => {
    const user = await prisma.user.create({
      data: { email: `multi-${Date.now()}@example.com`, password: 'hashed', emailVerified: true },
    });

    await prisma.subscription.createMany({
      data: [
        { userId: user.id, name: 'Netflix', cost: 15, currency: 'USD', billingCycle: 'monthly', renewalDate: utcMidnight(3), category: 'streaming', isActive: true },
        { userId: user.id, name: 'Spotify', cost: 10, currency: 'USD', billingCycle: 'monthly', renewalDate: utcMidnight(6), category: 'music', isActive: true },
      ],
    });

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(2);
    expect(mockSendRenewalReminderEmail).toHaveBeenCalledTimes(2);
  });
});
