import prisma from '../utils/db';
import { sendRenewalReminderEmail } from './emailService';

const RENEWAL_REMINDER_DAYS = Number(process.env.RENEWAL_REMINDER_DAYS ?? 7);

const DAY_MS = 24 * 60 * 60 * 1000;

export async function sendRenewalReminders(now: Date = new Date()): Promise<{ sent: number; skipped: number; failed: number }> {
  const windowEnd = new Date(now.getTime() + RENEWAL_REMINDER_DAYS * DAY_MS);
  const dedupCutoff = new Date(now.getTime() - (RENEWAL_REMINDER_DAYS + 1) * DAY_MS);

  const subscriptions = await prisma.subscription.findMany({
    where: {
      isActive: true,
      renewalDate: { gte: now, lte: windowEnd },
    },
    include: { user: { select: { email: true } } },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    const alreadyNotified = await prisma.notificationLog.findFirst({
      where: {
        subscriptionId: sub.id,
        type: 'renewal_reminder',
        sentAt: { gte: dedupCutoff },
      },
    });

    if (alreadyNotified) {
      skipped++;
      continue;
    }

    let status: 'sent' | 'failed' = 'sent';
    try {
      await sendRenewalReminderEmail({
        to: sub.user.email,
        subscriptionName: sub.name,
        renewalDate: sub.renewalDate,
        cost: Number(sub.cost),
        currency: sub.currency,
        billingCycle: sub.billingCycle,
      });
      sent++;
    } catch (err) {
      console.error(`[renewal-reminders] Failed to send reminder for subscription ${sub.id}:`, err);
      status = 'failed';
      failed++;
    }

    await prisma.notificationLog.create({
      data: {
        userId: sub.userId,
        subscriptionId: sub.id,
        type: 'renewal_reminder',
        status,
      },
    });
  }

  return { sent, skipped, failed };
}
