import prisma from '../utils/db';
import { sendRenewalReminderDigest, DigestItem } from './emailService';
import { reportServerError } from '../utils/reportError';
import { computeNextRenewal, daysUntil } from '../utils/renewal';

// One reminder per renewal occurrence, timed to the billing cycle: short cycles
// get short notice (a 7-day heads-up for a weekly sub would land the day the
// PREVIOUS charge hits), large charges get more lead time.
const REMINDER_WINDOW_DAYS: Record<string, number> = {
  weekly: 1,
  monthly: 3,
  quarterly: 7,
  annual: 14,
  yearly: 14,
};

// Unknown cycles fall back to monthly, mirroring computeNextRenewal.
function reminderWindow(billingCycle: string): number {
  return REMINDER_WINDOW_DAYS[billingCycle.toLowerCase()] ?? REMINDER_WINDOW_DAYS.monthly;
}

// The stored renewalDate is an anchor (first-payment date) that never advances
// in the DB — the upcoming renewal must be derived per subscription with
// computeNextRenewal, so the due-soon check happens here rather than in SQL.
// All due subscriptions for a user are bundled into one digest email; counts in
// the result are per subscription, not per email.
export async function sendRenewalReminders(now: Date = new Date()): Promise<{ sent: number; skipped: number; failed: number }> {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      isActive: true,
      // A cancelled subscription stays active until its period ends but will
      // not renew — there is no upcoming charge to warn about.
      cancelledAt: null,
      remindersMuted: false,
      user: {
        reminderEmailsEnabled: true,
        // Unverified addresses may be mistyped or someone else's — every other
        // email flow gates on verification, so reminders do too.
        emailVerified: true,
      },
    },
    include: { user: { select: { email: true } } },
  });

  const due = subscriptions
    .map((sub) => ({ sub, nextRenewal: computeNextRenewal(sub.renewalDate, sub.billingCycle, now) }))
    .filter(({ sub, nextRenewal }) => {
      const days = daysUntil(nextRenewal, now);
      return days >= 0 && days <= reminderWindow(sub.billingCycle);
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
      channel: 'email',
      status: 'sent',
      renewalDate: { in: due.map(({ nextRenewal }) => nextRenewal) },
    },
    select: { subscriptionId: true, renewalDate: true },
  });
  const alreadySent = new Set(priorSends.map((log) => `${log.subscriptionId}|${log.renewalDate!.toISOString()}`));

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // Group the still-unsent reminders per user so each user gets a single
  // digest email covering everything due, instead of one email per sub.
  const byUser = new Map<string, typeof due>();
  for (const entry of due) {
    if (alreadySent.has(`${entry.sub.id}|${entry.nextRenewal.toISOString()}`)) {
      skipped++;
      continue;
    }
    const group = byUser.get(entry.sub.userId) ?? [];
    group.push(entry);
    byUser.set(entry.sub.userId, group);
  }

  for (const [userId, group] of byUser) {
    const items: DigestItem[] = group.map(({ sub, nextRenewal }) => ({
      name: sub.name,
      cost: Number(sub.cost),
      currency: sub.currency,
      billingCycle: sub.billingCycle,
      renewalDate: nextRenewal,
      daysUntil: daysUntil(nextRenewal, now),
    }));

    let status: 'sent' | 'failed' = 'sent';
    try {
      await sendRenewalReminderDigest({ to: group[0].sub.user.email, items });
      sent += group.length;
    } catch (err) {
      reportServerError(`[renewal-reminders] Failed to send digest to user ${userId}`, err);
      status = 'failed';
      failed += group.length;
    }

    // A failed log write must not abort the loop — the remaining users should
    // still get their reminders this run. The cost is at-least-once delivery:
    // a sent email whose log write failed will be re-sent on the next run
    // because dedup won't see it.
    for (const { sub, nextRenewal } of group) {
      try {
        await prisma.notificationLog.create({
          data: {
            userId: sub.userId,
            subscriptionId: sub.id,
            type: 'renewal_reminder',
            channel: 'email',
            status,
            renewalDate: nextRenewal,
          },
        });
      } catch (err) {
        reportServerError(`[renewal-reminders] Failed to log ${status} reminder for subscription ${sub.id}`, err);
      }
    }
  }

  return { sent, skipped, failed };
}
