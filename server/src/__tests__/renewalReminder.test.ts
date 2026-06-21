import prisma from '../utils/db';
import { sendRenewalReminders } from '../services/renewalReminderService';
import * as emailService from '../services/emailService';

// Override the global mock from setup.ts to include sendRenewalReminderEmail
jest.mock('../services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
  sendDeletionWarningEmail: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
  sendRenewalReminderEmail: jest.fn().mockResolvedValue({ id: 'test-email-id' }),
}));

const mockSendRenewalReminderEmail = emailService.sendRenewalReminderEmail as jest.MockedFunction<typeof emailService.sendRenewalReminderEmail>;

const DAY_MS = 24 * 60 * 60 * 1000;

async function createUserAndSubscription({ renewalDaysFromNow, isActive = true }: { renewalDaysFromNow: number; isActive?: boolean }) {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const now = new Date();

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
      billingCycle: 'monthly',
      renewalDate: new Date(now.getTime() + renewalDaysFromNow * DAY_MS),
      category: 'streaming',
      isActive,
    },
  });

  return { user, subscription };
}

describe('sendRenewalReminders', () => {
  const now = new Date('2026-06-21T09:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends a reminder when subscription renews within the window', async () => {
    const { subscription } = await createUserAndSubscription({ renewalDaysFromNow: 5 });

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
  });

  it('skips when a notification log already exists for this renewal cycle', async () => {
    const { user, subscription } = await createUserAndSubscription({ renewalDaysFromNow: 5 });

    // Pre-insert a log entry (simulating a prior run)
    await prisma.notificationLog.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        type: 'renewal_reminder',
        status: 'sent',
        sentAt: new Date(now.getTime() - 1 * DAY_MS),
      },
    });

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockSendRenewalReminderEmail).not.toHaveBeenCalled();
  });

  it('skips inactive subscriptions', async () => {
    await createUserAndSubscription({ renewalDaysFromNow: 5, isActive: false });

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockSendRenewalReminderEmail).not.toHaveBeenCalled();
  });

  it('skips subscriptions with renewalDate in the past', async () => {
    await createUserAndSubscription({ renewalDaysFromNow: -1 });

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(0);
    expect(mockSendRenewalReminderEmail).not.toHaveBeenCalled();
  });

  it('skips subscriptions renewing beyond the reminder window', async () => {
    await createUserAndSubscription({ renewalDaysFromNow: 10 }); // default window is 7 days

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(0);
    expect(mockSendRenewalReminderEmail).not.toHaveBeenCalled();
  });

  it('logs a failed notification and continues when email send fails', async () => {
    const { subscription: sub1 } = await createUserAndSubscription({ renewalDaysFromNow: 3 });
    const { subscription: sub2 } = await createUserAndSubscription({ renewalDaysFromNow: 5 });

    mockSendRenewalReminderEmail
      .mockRejectedValueOnce(new Error('Resend API error'))
      .mockResolvedValueOnce({ id: 'ok' });

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);

    const failedLog = await prisma.notificationLog.findFirst({ where: { subscriptionId: sub1.id } });
    const sentLog = await prisma.notificationLog.findFirst({ where: { subscriptionId: sub2.id } });

    expect(failedLog!.status).toBe('failed');
    expect(sentLog!.status).toBe('sent');
  });

  it('sends separate reminders for multiple subscriptions belonging to the same user', async () => {
    const user = await prisma.user.create({
      data: { email: `multi-${Date.now()}@example.com`, password: 'hashed', emailVerified: true },
    });
    const baseDate = now.getTime();

    await prisma.subscription.createMany({
      data: [
        { userId: user.id, name: 'Netflix', cost: 15, currency: 'USD', billingCycle: 'monthly', renewalDate: new Date(baseDate + 3 * DAY_MS), category: 'streaming', isActive: true },
        { userId: user.id, name: 'Spotify', cost: 10, currency: 'USD', billingCycle: 'monthly', renewalDate: new Date(baseDate + 6 * DAY_MS), category: 'music', isActive: true },
      ],
    });

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(2);
    expect(mockSendRenewalReminderEmail).toHaveBeenCalledTimes(2);
  });

  it('sends a reminder when a prior log exists but is older than the dedup window', async () => {
    const { user, subscription } = await createUserAndSubscription({ renewalDaysFromNow: 5 });

    // Old log from more than RENEWAL_REMINDER_DAYS+1 days ago — should not trigger dedup
    await prisma.notificationLog.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        type: 'renewal_reminder',
        status: 'sent',
        sentAt: new Date(now.getTime() - 10 * DAY_MS),
      },
    });

    const result = await sendRenewalReminders(now);

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
  });
});
