# Renewal Reminders — Strategy (v3)

**Author:** Claude (with Anna, product decisions)
**Date:** 2026-07-13
**Status:** Approved — Phase 1 in implementation
**Supersedes:** `LIF-42-email-reminder-system.md` (pre-implementation design; LIF-11 shipped a different MVP)

---

## Where we are

Email renewal reminders shipped in PR #128 (LIF-11, 2026-07-11):

- Daily cron at 09:00 UTC (`RENEWAL_CRON`) → `sendRenewalReminders()` in
  `server/src/services/renewalReminderService.ts`.
- Loads all active, non-cancelled subscriptions, derives the upcoming renewal with
  `computeNextRenewal()` (the stored `renewalDate` is an anchor), and emails any that
  renew within `RENEWAL_REMINDER_DAYS` (default 7 — same window for every billing cycle).
- Dedup per renewal occurrence (`subscriptionId + type + renewalDate`, only
  `status: 'sent'` counts, so failed sends retry next run). One email per subscription,
  via Resend.

### Gaps this strategy addresses

1. **No opt-out.** There are no notification settings anywhere; the email footer tells
   users to *delete the subscription* to stop reminders. For a product whose core promise
   is trust around money, an alert you can't turn off is a liability.
2. **Flat 7-day window for all cycles.** A weekly subscription's "7 days before" reminder
   fires roughly the day the *previous* charge lands; an annual charge (largest, most
   worth cancelling) gets the same short notice as a monthly one.
3. **One email per subscription.** A user with several subs renewing the same week gets a
   drip of separate emails — inbox fatigue and spam-filter risk.
4. **No `emailVerified` filter.** Unverified (possibly mistyped, possibly someone else's)
   addresses receive reminder emails; every other email flow gates on verification.
5. **No timezone capture, no push.**

## Product decisions (Anna, 2026-07-13)

| Decision | Choice | Why |
|---|---|---|
| Default | **On by default (opt-out)** | Industry norm (Rocket Money, Bobby). Opt-in would leave most users unprotected from surprise charges. Requires a real, working opt-out. |
| Cadence | **Single touch per renewal, cycle-aware, daily digest** | One reminder per renewal occurrence; all due subs bundled into one email per user per day. |
| Push | **Email first, push added later as a second channel** | Push is glanceable but unreliable (tokens rot, permissions revoked) and currently blocked on EAS setup (LIF-88). Email stays the record; push complements, never replaces. |

## Timing model

Windows are per billing cycle (server constant, not user-editable for now — replaces the
global `RENEWAL_REMINDER_DAYS` env var):

| Billing cycle | Reminder | Why |
|---|---|---|
| weekly | 1 day before | anything earlier overlaps the previous cycle |
| monthly | 3 days before | enough time to cancel, single touch |
| quarterly | 7 days before | larger charge, more lead time |
| annual | 14 days before | biggest charge; users may need time to decide or negotiate |

Semantics kept from LIF-11: due when `0 ≤ daysUntil(nextRenewal) ≤ window`, deduped per
renewal occurrence. That means exactly one reminder per renewal, and a subscription added
mid-window still gets its reminder at the next daily run instead of being missed.

Delivery time: 09:00 UTC daily (Phase 1). `User.timezone` (IANA, auto-detected by the web
client) is captured from day one; Phase 2 switches the cron to hourly and delivers to each
user at 09:00 *their* time — the per-occurrence dedup makes that change safe with no
duplicate risk.

## Settings model

- `User.reminderEmailsEnabled` (default `true`) — global email toggle.
- `User.reminderPushEnabled` (default `true`) — inert until Phase 3; stored now so the
  push rollout needs no migration.
- `User.timezone` (default `"UTC"`) — IANA name, silently synced from the browser.
  ⚠️ Phase 2's manual override dropdown conflicts with this sync as-is: the web client
  re-syncs on every load, so it would clobber a manually chosen zone whenever it differs
  from the browser's. Phase 2 must add a "set manually" marker (e.g.
  `User.timezoneSetManually`) and skip the auto-sync when it's set.
- `Subscription.remindersMuted` (default `false`) — per-subscription mute for the "I know,
  stop telling me" case, editable in the subscription edit dialog.

Surfaces: a **Notifications** card on the web Profile page (mobile profile screen in
Phase 2). Every reminder email's footer links to profile settings — a genuine opt-out.

Email channel additionally requires `emailVerified: true`, matching every other email
flow. (Push will not: possession of the device is proof of ownership.)

## Digest email

One email per user per run covering all due subscriptions:

- Subject: `"Netflix renews in 3 days (SGD 15.98)"` for a single item,
  `"3 subscriptions renew soon"` for several.
- Body: one row per subscription — name, cost, billing cycle, renewal date, days left —
  in the existing `buildEmailHtml()` Paypr shell.
- CTA → `/subscriptions`; footer → profile settings.
- One `NotificationLog` row **per subscription** (dedup granularity unchanged), with the
  digest outcome applied to each.

## Push (Phase 3 — blocked on LIF-88 EAS setup; token registration is LIF-115)

- `server/src/services/pushService.ts` using the already-installed `expo-server-sdk` and
  the existing `DeviceToken` table.
- Same job, second channel: `NotificationLog.channel` (`"email" | "push"`) dedups each
  channel independently. Both channels fire per their own toggle — no fallback state
  machine.
- One digest-style push per user per run, chunked to all their tokens; store ticket ids;
  a receipts pass prunes tokens on `DeviceNotRegistered`.
- Notification tap deep-links to the subscriptions screen.

## Phases

1. **Now (this PR):** settings (schema + API + web UI), cycle-aware windows, digest email,
   `emailVerified` filter, timezone capture, strategy doc.
2. **Next:** mobile profile settings section, timezone override dropdown on web, hourly
   cron delivering at 09:00 local time.
3. **After LIF-88 + LIF-115:** push channel as above; reveal push toggles on web + mobile.

## Rollback

Unchanged: `ENABLE_CRON=false` on Railway stops all scheduled sends; `RENEWAL_CRON`
overrides the schedule.
