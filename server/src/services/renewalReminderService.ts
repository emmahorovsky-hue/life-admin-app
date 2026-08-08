import { Prisma } from '@prisma/client';
import prisma from '../utils/db';
import { sendRenewalReminderDigest, DigestItem } from './emailService';
import { sendRenewalPushDigest } from './pushService';
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

export type Channel = 'email' | 'push';
export type ChannelResult = { sent: number; skipped: number; failed: number };
export type ReminderResult = Record<Channel, ChannelResult>;

// Declared as a const so the row type can be derived from it rather than
// restated — same idiom as PUBLIC_USER_SELECT in constants/user.ts.
const DUE_CANDIDATE_INCLUDE = {
  user: {
    select: {
      email: true,
      emailVerified: true,
      reminderEmailsEnabled: true,
      reminderPushEnabled: true,
      deviceTokens: { select: { token: true } },
    },
  },
} satisfies Prisma.SubscriptionInclude;

type DueEntry = {
  sub: Prisma.SubscriptionGetPayload<{ include: typeof DUE_CANDIDATE_INCLUDE }>;
  nextRenewal: Date;
};

function emptyResult(): ChannelResult {
  return { sent: 0, skipped: 0, failed: 0 };
}

// The push channel ships dark, gated separately from the per-user toggle.
//
// `reminderPushEnabled` defaults to true and device tokens have been collected
// (with the OS permission prompt) since LIF-115, so without this flag the first
// deploy of this service starts notifying every existing user — from whatever
// app build they happen to have installed, which has neither the in-app toggle
// nor a foreground notification handler. App Store review sits between the
// server deploy and the build that carries both, so "ship them together" is not
// something the release process can actually offer.
//
// Turn it on once that build is live. Read per call rather than at module load
// so a flip doesn't need a restart to take effect — and so tests can set it.
function pushChannelEnabled(): boolean {
  return process.env.ENABLE_PUSH_REMINDERS === 'true';
}

// Dedup identity: one renewal occurrence of one subscription on one channel.
function dedupKey(subscriptionId: string, renewalDate: Date, channel: string): string {
  return `${subscriptionId}|${renewalDate.toISOString()}|${channel}`;
}

// The stored renewalDate is an anchor (first-payment date) that never advances
// in the DB — the upcoming renewal must be derived per subscription with
// computeNextRenewal, so the due-soon check happens here rather than in SQL.
// All due subscriptions for a user are bundled into one digest per channel;
// counts in the result are per subscription, not per message.
export async function sendRenewalReminders(now: Date = new Date()): Promise<ReminderResult> {
  // Channel eligibility is decided in JS, not in this query, because the two
  // channels no longer share a rule: email additionally requires a verified
  // address, push does not (possession of the device is proof enough), and each
  // has its own toggle. The query only narrows to users who want *something*.
  const subscriptions = await prisma.subscription.findMany({
    where: {
      isActive: true,
      // A cancelled subscription stays active until its period ends but will
      // not renew — there is no upcoming charge to warn about.
      cancelledAt: null,
      remindersMuted: false,
      user: {
        OR: [{ reminderEmailsEnabled: true }, { reminderPushEnabled: true }],
      },
    },
    include: DUE_CANDIDATE_INCLUDE,
  });

  const due: DueEntry[] = subscriptions
    .map((sub) => ({ sub, nextRenewal: computeNextRenewal(sub.renewalDate, sub.billingCycle, now) }))
    .filter(({ sub, nextRenewal }) => {
      const days = daysUntil(nextRenewal, now);
      return days >= 0 && days <= reminderWindow(sub.billingCycle);
    });

  const result: ReminderResult = { email: emptyResult(), push: emptyResult() };
  if (due.length === 0) return result;

  // One grouped dedup query covering both channels. Only successful sends count
  // — a failed attempt must not suppress retries on the next run. Dedup is keyed
  // to the exact renewal occurrence, so short cycles (e.g. weekly) get a fresh
  // reminder each cycle instead of being swallowed by a rolling time window,
  // and to the channel, so a delivered push never suppresses the email.
  const priorSends = await prisma.notificationLog.findMany({
    where: {
      subscriptionId: { in: due.map(({ sub }) => sub.id) },
      type: 'renewal_reminder',
      status: 'sent',
      renewalDate: { in: due.map(({ nextRenewal }) => nextRenewal) },
    },
    select: { subscriptionId: true, renewalDate: true, channel: true },
  });
  const alreadySent = new Set(
    priorSends.map((log) => dedupKey(log.subscriptionId, log.renewalDate!, log.channel))
  );

  // Group per user so each user gets a single digest per channel covering
  // everything due, instead of one message per subscription.
  const byUser = new Map<string, DueEntry[]>();
  for (const entry of due) {
    const group = byUser.get(entry.sub.userId) ?? [];
    group.push(entry);
    byUser.set(entry.sub.userId, group);
  }

  for (const [userId, group] of byUser) {
    const user = group[0].sub.user;
    const tokens = user.deviceTokens.map((t) => t.token);

    // Each channel is delivered and logged independently: neither may abort the
    // other, so a Resend outage still lets the push through and vice versa.
    await deliverChannel({
      channel: 'email',
      // Unverified addresses may be mistyped or someone else's — every other
      // email flow gates on verification, so reminders do too.
      eligible: user.reminderEmailsEnabled && user.emailVerified,
      group,
      userId,
      now,
      alreadySent,
      counters: result.email,
      send: async (items) => {
        await sendRenewalReminderDigest({ to: user.email, items });
      },
    });

    await deliverChannel({
      channel: 'push',
      // No registered device is not a failure — there is simply nowhere to send.
      eligible: pushChannelEnabled() && user.reminderPushEnabled && tokens.length > 0,
      group,
      userId,
      now,
      alreadySent,
      counters: result.push,
      send: async (items) => {
        const { invalidTokens, delivered } = await sendRenewalPushDigest({ tokens, items });

        // The device is gone (uninstalled, permission revoked). Drop the rows so
        // the table doesn't accumulate addresses that can never be delivered to.
        if (invalidTokens.length > 0) {
          try {
            await prisma.deviceToken.deleteMany({ where: { token: { in: invalidTokens } } });
          } catch (err) {
            reportServerError(`[renewal-reminders] Failed to prune device tokens for user ${userId}`, err);
          }
        }

        // Every device rejected, so nothing was delivered. Throwing is what makes
        // deliverChannel log `failed` rather than `sent`: the log is the record of
        // whether we warned this user, and a `sent` row here would both lie and
        // let dedup suppress the retry. Pruning first means an all-dead set of
        // tokens is gone by the next run, so this does not retry forever — the
        // user simply falls out of push eligibility.
        if (delivered === 0) {
          throw new Error(
            `Expo accepted none of the ${tokens.length} device token(s) for this digest`
          );
        }
      },
    });
  }

  return result;
}

async function deliverChannel({
  channel,
  eligible,
  group,
  userId,
  now,
  alreadySent,
  counters,
  send,
}: {
  channel: Channel;
  eligible: boolean;
  group: DueEntry[];
  userId: string;
  now: Date;
  alreadySent: Set<string>;
  counters: ChannelResult;
  send: (items: DigestItem[]) => Promise<void>;
}): Promise<void> {
  if (!eligible) return;

  const pending: typeof group = [];
  for (const entry of group) {
    if (alreadySent.has(dedupKey(entry.sub.id, entry.nextRenewal, channel))) {
      counters.skipped++;
      continue;
    }
    pending.push(entry);
  }
  if (pending.length === 0) return;

  const items: DigestItem[] = pending.map(({ sub, nextRenewal }) => ({
    name: sub.name,
    cost: Number(sub.cost),
    currency: sub.currency,
    billingCycle: sub.billingCycle,
    renewalDate: nextRenewal,
    daysUntil: daysUntil(nextRenewal, now),
  }));

  let status: 'sent' | 'failed' = 'sent';
  try {
    await send(items);
    counters.sent += pending.length;
  } catch (err) {
    reportServerError(`[renewal-reminders] Failed to send ${channel} digest to user ${userId}`, err);
    status = 'failed';
    counters.failed += pending.length;
  }

  // A failed log write must not abort the loop — the remaining users should
  // still get their reminders this run. The cost is at-least-once delivery:
  // a sent message whose log write failed will be re-sent on the next run
  // because dedup won't see it.
  for (const { sub, nextRenewal } of pending) {
    try {
      await prisma.notificationLog.create({
        data: {
          userId: sub.userId,
          subscriptionId: sub.id,
          type: 'renewal_reminder',
          channel,
          status,
          renewalDate: nextRenewal,
        },
      });
    } catch (err) {
      reportServerError(
        `[renewal-reminders] Failed to log ${status} ${channel} reminder for subscription ${sub.id}`,
        err
      );
    }
  }
}
