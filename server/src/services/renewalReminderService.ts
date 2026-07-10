import prisma from '../utils/db';
import { sendRenewalReminderEmail } from './emailService';
import { reportServerError } from '../utils/reportError';
import { computeNextRenewal, daysUntil } from '../utils/renewal';

const RENEWAL_REMINDER_DAYS = Number(process.env.RENEWAL_REMINDER_DAYS ?? 7);

// The stored renewalDate is an anchor (first-payment date) that never advances
// in the DB — the upcoming renewal must be derived per subscription with
// computeNextRenewal, so the due-soon check happens here rather than in SQL.
export async function sendRenewalReminders(now: Date = new Date()): Promise<{ sent: number; skipped: number; failed: number }> {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      isActive: true,
      // A cancelled subscription stays active until its period ends but will
      // not renew — there is no upcoming charge to warn about.
      cancelledAt: null,
    },
    include: { user: { select: { email: true } } },
  });

  const due = subscriptions
    .map((sub) => ({ sub, nextRenewal: computeNextRenewal(sub.renewalDate, sub.billingCycle, now) }))
    .filter(({ nextRenewal }) => {
      const days = daysUntil(nextRenewal, now);
      return days >= 0 && days <= RENEWAL_REMINDER_DAYS;
    });

  if (due.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  // One grouped dedup query for all candidates. Only successful sends count —
  // a failed attempt must not suppress retries on the next run. Dedup is keyed
  // to the exact renewal occurrence, so short cycles (e.g. weekly) get a fresh
  // reminder each cycle instead of being swallowed by a rolling time window.
  const priorSends = await prisma.notificationLog.findMany({
    where: {
      subscriptionId: { in: due.map(({ sub }) => sub.id) },
      type: 'renewal_reminder',
      status: 'sent',
      renewalDate: { in: due.map(({ nextRenewal }) => nextRenewal) },
    },
    select: { subscriptionId: true, renewalDate: true },
  });
  const alreadySent = new Set(priorSends.map((log) => `${log.subscriptionId}|${log.renewalDate!.toISOString()}`));

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const { sub, nextRenewal } of due) {
    if (alreadySent.has(`${sub.id}|${nextRenewal.toISOString()}`)) {
      skipped++;
      continue;
    }

    let status: 'sent' | 'failed' = 'sent';
    try {
      await sendRenewalReminderEmail({
        to: sub.user.email,
        subscriptionName: sub.name,
        renewalDate: nextRenewal,
        cost: Number(sub.cost),
        currency: sub.currency,
        billingCycle: sub.billingCycle,
      });
      sent++;
    } catch (err) {
      reportServerError(`[renewal-reminders] Failed to send reminder for subscription ${sub.id}`, err);
      status = 'failed';
      failed++;
    }

    await prisma.notificationLog.create({
      data: {
        userId: sub.userId,
        subscriptionId: sub.id,
        type: 'renewal_reminder',
        status,
        renewalDate: nextRenewal,
      },
    });
  }

  return { sent, skipped, failed };
}
