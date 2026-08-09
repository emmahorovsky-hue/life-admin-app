# Renewal Reminders — Strategy (v3)

**Author:** Claude (with Anna, product decisions)
**Date:** 2026-07-13
**Status:** Approved — all three phases shipped. Local-time delivery landed in LIF-252,
which is also what unblocked turning the push channel on.
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

Delivery time: **09:00 in the user's own timezone** (LIF-252). The cron runs hourly and
each run delivers only to the users for whom it is currently daytime; `User.timezone`
(IANA, auto-detected by the web client) is what decides. Per-occurrence dedup is what makes
an hourly job safe — exactly-once comes from the log, not from the schedule.

Two details worth keeping:

- The window is **09:00–21:00 local, not the single 09:00 hour** this doc originally
  specified. With an hourly job a one-hour window means a deploy or restart spanning that
  hour drops the whole day, and for a weekly subscription (1-day notice) the reminder is
  then never sent at all. The wide window plus dedup delivers at 09:00 local normally and
  self-heals otherwise. It also makes the repeated hour of a DST fall-back a non-event.
- `daysUntil` is counted from the user's **local calendar day**, not the server's.
  Otherwise a user in UTC+13 reads "renews in 2 days" while their own calendar says
  tomorrow, and the boundary picks the wrong occurrence outright.

Until LIF-252 this was 09:00 UTC for everyone — 02:00 in California. Survivable while email
was the only channel; not survivable for push, which is why it gated the rollout.

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

## Push (Phase 3 — shipped)

Built as designed; no migration was needed, since `reminderPushEnabled` and
`NotificationLog.channel` were provisioned in Phase 1 for exactly this.

- `server/src/services/pushService.ts` uses the already-installed `expo-server-sdk` and
  the existing `DeviceToken` table.
- Same job, second channel: `NotificationLog.channel` (`"email" | "push"`) dedups each
  channel independently. Both channels fire per their own toggle — no fallback state
  machine.
- Channel eligibility moved out of the Prisma query into JS, because the two channels no
  longer share a rule: email additionally requires `emailVerified`, push does not. The
  query now narrows to users who want *either* channel.
- `sendRenewalReminders()` returns `{ email, push }` counters rather than one flat triple.
- One digest push per user per run, one message per token so tickets stay index-aligned;
  tokens Expo rejects as `DeviceNotRegistered` are deleted.
- Notification tap deep-links to the subscriptions screen
  (`mobile/lib/notificationRouting.ts`), including from a cold start.
- Push toggles revealed on both web and mobile; mobile also shows an "open Settings" path
  when OS permission is denied, rather than a switch that cannot work.

**The channel ships dark.** `ENABLE_PUSH_REMINDERS` gates the whole push path,
independently of the per-user toggle, and defaults to off. `reminderPushEnabled`
defaults to `true` and tokens have been registered since LIF-115, so an ungated
deploy notifies every existing user at once — from the build they already have,
which carries neither the in-app toggle nor a foreground handler. The server and
that build cannot ship together because App Store review sits between them.
Sequence: deploy the server (flag off) → ship the mobile build → set the flag.
Nothing is logged while the flag is off, so the first run after flipping it still
delivers the current renewal occurrence rather than finding it deduped away.

Two deliberate deviations from the design above:

- **No receipts pass.** Ticket-level `DeviceNotRegistered` pruning covers the common case;
  a second scheduled job to poll receipts 15 minutes later was judged not worth its
  complexity at this user count. The ticket ids are not stored.
- **No Android notification icon.** `expo-notifications` gets `color` but not `icon`: the
  only monochrome asset in the repo is still the pre-rebrand chevron. Belongs to LIF-234
  along with FCM credentials; iOS is unaffected and uses the app icon.

Known gap: `pushService.ts` has no unit test. `src/__tests__/setup.ts` mocks the module
wholesale, so what the suite covers is the orchestration around it — channel eligibility,
per-channel dedup, token pruning, partial failure — which is where the logic lives.

The reason for the wholesale mock has since gone: `pushService` now loads `expo-server-sdk`
on first send rather than at import, so importing the module no longer drags pure ESM into
jest's CommonJS registry. The helpers that shape what a user actually reads — `joinNames`,
`buildContent` — can be exported and tested directly whenever someone wants them covered.

## Phases

1. **Now (this PR):** settings (schema + API + web UI), cycle-aware windows, digest email,
   `emailVerified` filter, timezone capture, strategy doc.
2. **Shipped (LIF-252):** hourly cron delivering at 09:00 local time, plus timezone sync on
   **mobile** — which the plan had missed. Only the web client synced a zone, so an
   app-only user sat on the `"UTC"` default and would have been pushed at 09:00 UTC no
   matter where they live; local-time delivery would have been inert for exactly the
   population that receives push. The manual override dropdown is still *not* built, so
   the ⚠️ above stands, and now applies to two auto-syncing clients rather than one:
   whoever adds it owes it a `timezoneSetManually` marker.
3. **Live:** push channel as above; push toggles revealed on web + mobile.
   `ENABLE_PUSH_REMINDERS` turned on once LIF-252's two prerequisites were in — local-time
   delivery, and unregistering device tokens on logout.

## Rollback

Unchanged: `ENABLE_CRON=false` on Railway stops all scheduled sends; `RENEWAL_CRON`
overrides the schedule.
