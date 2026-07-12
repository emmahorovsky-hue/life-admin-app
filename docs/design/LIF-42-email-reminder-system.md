# LIF-42: Email Reminder System Architecture

**Author:** CTO Agent
**Date:** 2026-05-09
**Status:** Superseded — LIF-11 shipped a different MVP (PR #128); current strategy lives in [`renewal-reminders-strategy.md`](./renewal-reminders-strategy.md)
**Audience:** Engineer agent (implementation), Anna (sign-off on flagged decisions)

---

## TL;DR

Send users an email 7 / 3 / 1 days before each subscription's `renewalDate` so they have
time to cancel before being charged. Architecture is intentionally simple for MVP: a
single Node-cron job inside the existing API process, idempotent send via Resend, with
`NotificationLog` as both the audit trail and the dedup mechanism. No Redis/BullMQ until
we outgrow it.

```
                           ┌─────────────────────────┐
                           │ node-cron (in API proc) │
                           │   "0 9 * * *" UTC       │
                           └────────────┬────────────┘
                                        │ daily 09:00 UTC
                                        ▼
                  ┌────────────────────────────────────────┐
                  │ ReminderJob                            │
                  │  1. Acquire pg advisory lock           │
                  │  2. Query subs due in {7,3,1} days     │
                  │  3. For each: dedup via NotificationLog│
                  │  4. Send via Resend (with retry)       │
                  │  5. Insert NotificationLog row         │
                  │  6. Release lock                       │
                  └────────────────────────────────────────┘
                                        │
                                        ▼
                                ┌──────────────┐
                                │ Resend API   │
                                └──────────────┘
```

---

## Goals & non-goals

**Goals (MVP):**
- Email reminders 7/3/1 days before `renewalDate`.
- Idempotent: re-running the job (or running twice in parallel) never sends duplicates.
- Auditable: every send logged in `NotificationLog`.
- Resilient: transient Resend failures retry; permanent failures recorded but don't block
  other users.
- User-controllable: ability to unsubscribe / configure reminder windows.

**Non-goals (not yet):**
- Push notifications, SMS.
- Per-subscription reminder customization.
- Calendar (.ics) attachments.
- Real-time triggering (e.g., webhook on subscription change).
- Worker process separation (single API dyno is fine for MVP).

---

## Architecture decisions

### 1. Run cron inside the API process (not a separate worker)
**Why:** MVP scale. Railway lets us split into a worker service later for free; for now
one process is simpler. `node-cron` is already in `package.json`.

**Risk:** Multiple Railway replicas would each run the cron → duplicate sends. Mitigation:
**PostgreSQL advisory lock** (see below) so only one replica actually runs the job, even
if we scale horizontally.

> **🚩 Decision needed #1 (Anna):** Confirm we're staying on a single Railway replica
> for now. If you plan to scale to >1 replica before splitting out a worker, the lock
> becomes essential (it's cheap so we'll add it anyway).

---

### 2. Use Resend for delivery
**Why:**
- `RESEND_API_KEY` already placeholder'd in `.env.example`.
- Free tier: 3,000 emails/month, 100/day — plenty for MVP.
- Clean React Email templates (Anna's UI taste).
- Single env var, no domain config required for the test domain (until we want
  `from: reminders@lifeadmin.dev`).

**Alternatives considered:** SendGrid (heavier setup), AWS SES (cheap but more ops),
Postmark (great deliverability but $15/mo from day 1).

> **🚩 Decision needed #2 (Anna):** Sender domain. Options:
> - `onboarding@resend.dev` — works immediately, looks unprofessional.
> - `reminders@lifeadmin.dev` — needs DNS records (SPF/DKIM/DMARC), 15 min of work, looks
>   real. **Recommended.**

---

### 3. Use `NotificationLog` for dedup, not a queue
**Why:** We already have the table. Each send is uniquely identifiable by
`(subscriptionId, type, reminderWindow, renewalDate)`. Before sending, we check
"already logged?" — if yes, skip. If no, send + log.

**Alternative:** Redis/BullMQ. Massive overkill for an MVP doing maybe 50 emails/day.

---

### 4. Single daily run, not per-minute
**Cron expression:** `0 9 * * *` (09:00 UTC daily, ~5pm Singapore — Anna's prime time).

Per-user timezone email delivery is a nice-to-have we can add later (#future-work).

---

## Schema changes

### Update `User` model
```prisma
model User {
  // ... existing
  emailVerified         Boolean   @default(false) // see LIF-47
  reminderEmailsEnabled Boolean   @default(true)
  reminderDaysBefore    Int[]     @default([7, 3, 1])
  timezone              String    @default("UTC") // IANA name, e.g. "Asia/Singapore"
}
```

### Update `NotificationLog` model
The existing `NotificationLog` is too thin. We need enough columns to dedup AND debug.

```prisma
model NotificationLog {
  id             String   @id @default(cuid())
  userId         String
  subscriptionId String?  // nullable: future per-account emails

  type           String   // "renewal_reminder" | "lockout" | "verify_email" | ...
  channel        String   @default("email") // "email" | "push" | ...
  reminderWindow Int?     // 7, 3, 1 — only for renewal_reminder
  renewalDate    DateTime? // snapshot of sub.renewalDate at send time

  status         String   // "queued" | "sent" | "failed" | "skipped"
  providerMessageId String? // Resend's id, for support tickets
  error          String?  // last error message if failed
  attempts       Int      @default(0)

  sentAt         DateTime @default(now())

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  subscription Subscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)

  // The dedup constraint: same user+sub+type+window+renewalDate cannot be sent twice
  @@unique([subscriptionId, type, reminderWindow, renewalDate], name: "uniq_reminder_send")
  @@index([userId])
  @@index([subscriptionId])
  @@index([sentAt])
  @@index([status])
}
```

**Add reverse relation in `Subscription`:**
```prisma
model Subscription {
  // ... existing
  notifications NotificationLog[]
}
```

**Migration name:** `add_reminder_dedup_and_user_prefs`

---

## Job implementation

### File layout
```
server/src/jobs/
  index.ts                # registers all cron jobs at boot
  reminderJob.ts          # the job
  reminderJob.test.ts     # unit tests
server/src/services/
  emailService.ts         # Resend wrapper + retry
  templates/
    renewalReminder.tsx   # React Email template
server/src/utils/
  advisoryLock.ts         # pg advisory lock helper
  logger.ts               # winston (from PR-3)
```

### Boot wiring (`server/src/index.ts`)
```ts
import { startCronJobs } from './jobs';

if (process.env.ENABLE_CRON !== 'false') {
  startCronJobs();
}
```

`ENABLE_CRON=false` lets us turn it off in test/CI without forking.

### `jobs/index.ts`
```ts
import cron from 'node-cron';
import { runReminderJob } from './reminderJob';
import { logger } from '../utils/logger';

export function startCronJobs() {
  // 09:00 UTC every day
  cron.schedule('0 9 * * *', async () => {
    try {
      await runReminderJob();
    } catch (err) {
      logger.error({ err, job: 'reminder' }, 'reminder job crashed');
    }
  }, { timezone: 'UTC' });

  logger.info('cron jobs registered');
}
```

### `jobs/reminderJob.ts` (the meat)
```ts
import prisma from '../utils/db';
import { sendRenewalReminder } from '../services/emailService';
import { withAdvisoryLock } from '../utils/advisoryLock';
import { logger } from '../utils/logger';

const REMINDER_WINDOWS = [7, 3, 1] as const;
const LOCK_KEY = 4242_0001; // arbitrary unique int for pg_advisory_lock

export async function runReminderJob(now: Date = new Date()) {
  return withAdvisoryLock(LOCK_KEY, async () => {
    logger.info({ job: 'reminder' }, 'reminder job started');
    const startedAt = Date.now();

    let totalSent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const days of REMINDER_WINDOWS) {
      // Compute the date range for "renewalDate is exactly N days from now"
      // We use a 24-hour window in UTC.
      const target = new Date(now);
      target.setUTCDate(target.getUTCDate() + days);
      const windowStart = new Date(target); windowStart.setUTCHours(0,0,0,0);
      const windowEnd = new Date(target);   windowEnd.setUTCHours(23,59,59,999);

      const subs = await prisma.subscription.findMany({
        where: {
          isActive: true,
          renewalDate: { gte: windowStart, lte: windowEnd },
          user: {
            reminderEmailsEnabled: true,
            emailVerified: true,
            reminderDaysBefore: { has: days },
          },
        },
        include: { user: true },
      });

      logger.info({ days, count: subs.length }, 'subs in window');

      for (const sub of subs) {
        try {
          // Idempotency: try to insert log row first with status=queued.
          // If unique constraint trips, we've already handled this one.
          const created = await prisma.notificationLog.create({
            data: {
              userId: sub.userId,
              subscriptionId: sub.id,
              type: 'renewal_reminder',
              channel: 'email',
              reminderWindow: days,
              renewalDate: sub.renewalDate,
              status: 'queued',
            },
          }).catch((e: any) => {
            if (e?.code === 'P2002') return null; // unique violation == already sent
            throw e;
          });

          if (!created) { totalSkipped++; continue; }

          const result = await sendRenewalReminder({
            to: sub.user.email,
            userName: sub.user.name,
            subscription: sub,
            daysUntil: days,
          });

          await prisma.notificationLog.update({
            where: { id: created.id },
            data: {
              status: 'sent',
              providerMessageId: result.id,
              attempts: 1,
            },
          });
          totalSent++;
        } catch (err: any) {
          totalFailed++;
          logger.error({ err, subId: sub.id, days }, 'reminder send failed');
          // Best-effort failure log update (the queued row exists)
          await prisma.notificationLog.updateMany({
            where: {
              subscriptionId: sub.id,
              reminderWindow: days,
              renewalDate: sub.renewalDate,
              status: 'queued',
            },
            data: {
              status: 'failed',
              error: String(err?.message ?? err).slice(0, 500),
              attempts: { increment: 1 },
            },
          });
        }
      }
    }

    logger.info(
      { job: 'reminder', totalSent, totalSkipped, totalFailed, elapsedMs: Date.now() - startedAt },
      'reminder job finished'
    );
  });
}
```

### `utils/advisoryLock.ts`
```ts
import prisma from './db';

/**
 * Run `fn` only if we acquire a pg session-level advisory lock on `key`.
 * If another replica holds it, we no-op and return null. Lock auto-releases on disconnect
 * but we explicitly unlock for safety.
 */
export async function withAdvisoryLock<T>(key: number, fn: () => Promise<T>): Promise<T | null> {
  const result = await prisma.$queryRawUnsafe<{ locked: boolean }[]>(
    `SELECT pg_try_advisory_lock(${key}) AS locked`
  );
  if (!result[0]?.locked) {
    return null; // someone else has it
  }
  try {
    return await fn();
  } finally {
    await prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock(${key})`);
  }
}
```

### `services/emailService.ts`
```ts
import { Resend } from 'resend';
import { renderRenewalReminder } from './templates/renewalReminder';
import { logger } from '../utils/logger';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? 'reminders@lifeadmin.dev';

type SendArgs = {
  to: string;
  userName: string | null;
  subscription: { name: string; cost: any; currency: string; renewalDate: Date; billingCycle: string; };
  daysUntil: number;
};

export async function sendRenewalReminder(args: SendArgs) {
  const { html, text, subject } = renderRenewalReminder(args);

  // Retry with exponential backoff on transient failures.
  const maxAttempts = 3;
  let lastErr: any;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await resend.emails.send({ from: FROM, to: args.to, subject, html, text });
      if (res.error) throw new Error(`${res.error.name}: ${res.error.message}`);
      return res.data!; // { id: string }
    } catch (err: any) {
      lastErr = err;
      const status = err?.statusCode;
      // 4xx (except 429) are permanent — fail fast
      if (status && status >= 400 && status < 500 && status !== 429) break;
      await new Promise(r => setTimeout(r, (2 ** i) * 500));
    }
  }
  throw lastErr;
}
```

### `services/templates/renewalReminder.tsx`
Use [React Email](https://react.email) (works with Resend, type-safe, easy to test).

```tsx
import { Html, Body, Container, Text, Heading, Button, Section } from '@react-email/components';
import { render } from '@react-email/render';

export function renderRenewalReminder(args: {
  userName: string | null;
  subscription: { name: string; cost: any; currency: string; renewalDate: Date; billingCycle: string };
  daysUntil: number;
}) {
  const { userName, subscription, daysUntil } = args;
  const cost = `${subscription.currency} ${Number(subscription.cost).toFixed(2)}`;
  const dateStr = new Date(subscription.renewalDate).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  const subject = daysUntil === 1
    ? `${subscription.name} renews tomorrow (${cost})`
    : `${subscription.name} renews in ${daysUntil} days (${cost})`;

  const jsx = (
    <Html>
      <Body style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f6f6f6', padding: 24 }}>
        <Container style={{ maxWidth: 560, background: 'white', padding: 32, borderRadius: 8 }}>
          <Heading>Heads up{userName ? `, ${userName}` : ''}</Heading>
          <Text>
            Your <strong>{subscription.name}</strong> subscription renews{' '}
            {daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`} on <strong>{dateStr}</strong>.
          </Text>
          <Section style={{ background: '#fafafa', padding: 16, borderRadius: 6, margin: '16px 0' }}>
            <Text><strong>Cost:</strong> {cost} ({subscription.billingCycle})</Text>
          </Section>
          <Text>
            If you still want it, ignore this. If not, cancel before {dateStr} to avoid the charge.
          </Text>
          <Button href={`${process.env.CLIENT_URL}/subscriptions`} style={{ background: '#000', color: '#fff', padding: '12px 24px', borderRadius: 6 }}>
            Manage subscriptions
          </Button>
          <Text style={{ fontSize: 12, color: '#888', marginTop: 32 }}>
            You're receiving this because reminders are on.{' '}
            <a href={`${process.env.CLIENT_URL}/settings/notifications`}>Turn them off</a>.
          </Text>
        </Container>
      </Body>
    </Html>
  );

  return {
    subject,
    html: render(jsx),
    text: render(jsx, { plainText: true }),
  };
}
```

---

## Idempotency proof

Two concurrent runs of `runReminderJob`:
1. Replica A: `pg_try_advisory_lock(4242_0001)` → returns true.
2. Replica B: same call → returns false → no-op.

Two consecutive runs (same day, same window):
1. Run 1: `INSERT INTO NotificationLog (...) VALUES (...)` — succeeds.
2. Send email, update status='sent'.
3. Run 2: same INSERT → unique constraint `uniq_reminder_send` violation (P2002) → skip.

Crash mid-send (sent email but didn't update log):
- Row exists with status='queued'. Next run still skips it (dedup is on the unique
  constraint, not status). User got one email. Acceptable.

Crash before send (row inserted but email not sent):
- Row exists with status='queued', no email sent. **This is a real bug we accept for MVP.**
  Mitigation: a follow-up cleanup job that requeues `status='queued'` rows older than
  10 minutes. Tracked as future work — not blocking MVP.

---

## Testing strategy

### Unit tests (`reminderJob.test.ts`)
1. Sub due in 7 days → email sent, log row 'sent'.
2. Sub due in 5 days → skipped (no window match).
3. Same sub, second run → skipped (unique constraint).
4. User has `reminderEmailsEnabled=false` → skipped.
5. User unverified → skipped.
6. Resend returns 5xx 3 times → log row 'failed' with error.
7. Resend returns 422 → log row 'failed' with error, no retry.
8. Two concurrent jobs → only one sends (lock works).

Mock Resend with vitest/jest mock. Use a test SQLite or testcontainer Postgres.

### Manual smoke test (Engineer to run before merging)
1. Set `RESEND_API_KEY` to test mode key.
2. Create a sub due tomorrow.
3. Run `npm run job:reminders` (add a `bin/run-reminder-job.ts` entrypoint).
4. Verify email arrives, log row exists with status='sent'.
5. Re-run — verify no second email.

---

## Operational concerns

### Monitoring
- Log job summary line on each run (`totalSent`, `totalSkipped`, `totalFailed`, `elapsedMs`).
- Future: emit metric to Sentry/Datadog `cron.reminder.success` (gauge).
- Failure threshold: if `totalFailed / (totalSent + totalFailed) > 0.2`, alert (post-MVP).

### Backfill / catchup
If we deploy at noon and the 09:00 cron didn't run, we miss a day. Add a manual entrypoint:
```
package.json: "job:reminders": "tsx src/bin/run-reminder-job.ts"
```
Anna can run `railway run npm run job:reminders` to catch up.

### Cost
Resend free tier: 3,000/mo. 50 active subs × 3 windows = ~150/mo. Fine.

### Privacy / GDPR
- Each email has unsubscribe link → `/settings/notifications`.
- `NotificationLog` rows deleted with user (cascade).
- Don't include sensitive fields (notes) in the email — just name/cost/date.

---

## Frontend changes (out of scope for this ticket but flagged)

User settings page needs:
- `reminderEmailsEnabled` toggle.
- `reminderDaysBefore` multiselect (7/3/1 default).
- `timezone` dropdown (auto-detect from `Intl.DateTimeFormat().resolvedOptions().timeZone`,
  let user override).
- (Future) per-subscription override.

API surface:
- `PATCH /api/auth/me` — accept `reminderEmailsEnabled`, `reminderDaysBefore`, `timezone`.

This becomes a separate frontend ticket. Engineer should still ship the API endpoint
in this PR so frontend can wire up next sprint.

---

## Future enhancements (not for MVP)

1. **Per-user timezone delivery** — split job into per-timezone runs at 09:00 local.
2. **Move cron to a separate Railway worker service** when we hit 1k+ active users.
3. **Calendar (.ics) attachment** to "add renewal date to your calendar".
4. **Email open / click tracking** via Resend webhooks → store in NotificationLog.
5. **Webhook-driven reminders** — when sub created with renewalDate < 7 days, send
   immediately.
6. **Failure cleanup job** — requeue `status='queued'` rows older than 10 min.

---

## Migration & rollout plan

1. Engineer ships PR with schema migration + job code.
2. Deploy to Railway. New columns get defaults so existing users opt-in (`reminderEmailsEnabled=true`).
3. Verify `RESEND_API_KEY` and `EMAIL_FROM` are set in Railway env.
4. Wait 24 hours, check logs for first run.
5. Anna verifies an email arrives in her own inbox (she has subs; force a renewalDate to be
   `today + 7 days` for testing).

If something goes wrong: set `ENABLE_CRON=false` in Railway → restart → job stops.

---

## Open decisions for Anna

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Single Railway replica for MVP? | Yes. Lock added regardless. |
| 2 | Sender domain — `resend.dev` or `lifeadmin.dev`? | `lifeadmin.dev`. 15 min DNS work. |
| 3 | Default reminder windows: 7/3/1 OK? Or 7/1 only? | 7/3/1 — three touches is the sweet spot, the unsubscribe link makes it user-controllable. |
| 4 | Send time: 09:00 UTC global, or per-user local time? | 09:00 UTC for MVP. Per-user local in v2. |
| 5 | Block reminders for unverified emails? | Yes (matches LIF-47 design). |

---

## Handoff to Engineer

Implementation order:
1. Add Resend account + DNS (Anna does steps 2/3 above; Engineer documents).
2. Schema migration + Prisma client regen.
3. `emailService.ts` + template + a one-off "send a test" CLI script.
4. `advisoryLock.ts`.
5. `reminderJob.ts` + tests.
6. `jobs/index.ts` + wire into `index.ts`.
7. `PATCH /api/auth/me` for user prefs.
8. README update with env vars + cron schedule.

Estimate: **1.5–2 days**.

Dependencies:
- LIF-41 PR-1 should land first (helmet, error handler) so logs are clean.
- LIF-47 (email verification) is a soft prerequisite — we filter on `emailVerified=true`,
  so without LIF-47 no one ever gets an email. Recommend shipping LIF-47 alongside this
  one, or temporarily defaulting `emailVerified=true` for existing users until LIF-47
  ships.
