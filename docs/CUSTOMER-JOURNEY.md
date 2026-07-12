# Customer Journey Review

A product review of Paypr across the eight stages of the customer journey, from first
awareness to loyalty. Unlike the rest of `docs/`, this document is not about how the system
is built — it is about what the customer experiences.

**Reviewed:** 2026-07-12 · **Against:** `chore/LIF-153-server-dep-placement` (post-`c2cfb87`)

## Scope and limits of this review

This review was made by reading the codebase: the landing page, both clients, the API, the
Prisma schema, the cron jobs, and the open branches. That bounds what it can claim.

- Stages 1, 2, 7 and 8 mostly live **outside** a repository. Where this document says
  "nothing exists," it means **nothing exists in the product or the codebase**. Marketing,
  content, or support handled manually elsewhere would not be visible here, and the ratings
  for those stages should be revised if such activity exists.
- There is **no product analytics of any kind** in Paypr — no PostHog, GA, Mixpanel, or
  Segment. Sentry is present, but it is error tracking for the team, not behaviour tracking
  for users. **Every rating below is therefore a judgement, not a measurement**, and it
  cannot currently be falsified with data. Fixing that is the precondition for everything
  else in this document.

## Summary

Paypr is a **well-engineered product with an unmanaged customer journey**. The engineering
quality is high — clean service layers, a correct cancel-vs-delete model, session revocation
done properly, a landing page with real craft. The journey around it has three holes that
code quality does not fill:

1. **The customer is invisible.** No analytics, so no funnel, no activation rate, no retention.
2. **Time-to-value is "type in your subscriptions from memory, one at a time."** That is the
   entire onboarding.
3. **The mobile app requests push permission and stores the token — and nothing ever sends a
   push.** The write path is complete; the read path does not exist.

| # | Stage | Rating | Reality |
|---|-------|:------:|---------|
| 1 | Awareness | **2/5** | OG tags, a domain, an og-image. No attribution possible. |
| 2 | Education | **3/5** | A strong landing page carrying the entire stage alone. |
| 3 | Acquisition | **2/5** | Signup works; no business model; unverified accounts are hard-deleted. |
| 4 | Product | **3/5** | Solid core, a real AI differentiator, ~57 open audit issues. |
| 5 | Onboarding | **2/5** | One empty state and an "Add Subscription" button. |
| 6 | Usage | **2/5** | One email, seven days before renewal. That is the whole return ritual. |
| 7 | Support | **1/5** | The legal documents promise `[contact@paypr.com]` — a literal placeholder. |
| 8 | Loyalty | **1/5** | Does not exist as a concept in the product. |

---

## Stage 1 — Awareness · 2/5

**What exists.** Proper Open Graph and Twitter card metadata, `og-image.png`, the `paypr.live`
domain, favicons, a webmanifest (`client/index.html`, `client/public/`). Someone cared about
the share preview.

**What is missing.** No `robots.txt`, no sitemap, no content surface, no referral mechanism.

**The core friction is not a missing channel — it is missing attribution.** There is no way to
tell where a single user came from, so any awareness spend is currently unmeasurable.

## Stage 2 — Education · 3/5

**What exists.** `client/src/pages/Landing.tsx` is the strongest asset in the repository: 940
lines, framer-motion, a "Renewal Radar" timeline, a receipt ticker, and specific, confident
copy ("Your entire paper trail", "Stop guessing. Start knowing.").

**Friction 1 — the page over-promises relative to the product.** It advertises six tracked
types: subscriptions, contracts, memberships, warranties, domain names, leases. The database
has one model, `Subscription`, differentiated only by a `category` string. A visitor who
arrives to file a warranty finds a subscription form. That gap is set at the moment of highest
intent.

**Friction 2 — nothing can be seen without an account.** No demo, no sandbox, no depth of
screenshots. The product asks for an email before showing anything real.

## Stage 3 — Acquisition · 2/5

Registration and login are clean. Beyond that this stops being a product question and becomes
a strategy question: **there is no business model in the code.** No Stripe, no Paddle, no
pricing page, no plan tiers. The landing page says "Free to use. No credit card required."

That is a legitimate pre-revenue choice, but it means stages 3 and 8 have **no mechanism to
exist** — there is nothing to upsell, renew, or cross-sell. If the choice is deliberate it
should be stated out loud, because it defines what "loyalty" can mean here. If it is not
deliberate, it is the largest unmade decision on the board.

**Friction 1 — unverified accounts are hard-deleted after 7 days.**
`server/src/services/accountCleanupService.ts` (`GRACE_PERIOD_DAYS=7`, one warning email 24h
prior) runs `deleteMany` on `User`. A user who signs up, adds their subscriptions, misses the
verification email in spam, and returns on day 8 finds their account and all their data gone.
The rule is principled — it protects the user table from junk — but the customer-side cost is
total data loss for someone who did the hard work of onboarding.

**Friction 2 — domain mismatch.** Verification emails send from `noreply@paypr.live`; the
legal documents give `contact@paypr.com`.

## Stage 4 — Product · 3/5

**What works.** Subscription CRUD, a dashboard with a per-currency category breakdown, a
timeline view, and a correctly modelled cancel-vs-delete distinction (`cancelledAt` freezes
the renewal date at the end of the paid period; `isActive` is a separate soft-delete).
Multi-currency was handled properly rather than papered over.

**The differentiator.** AI receipt/invoice extraction (`aiService.ts`,
`ReceiptExtractionFlow`, `ReviewExtractedDialog`) — upload a receipt, Claude extracts the
subscription. It is the only part of the product that is meaningfully hard to copy. It is
also, tellingly, behind a dialog rather than being the front door.

**Against that.** Roughly **57 open `audit-*` branches** for known defects, several
customer-facing and unmerged: `alert()` used for delete/cancel/resume confirmations
(LIF-139), the edit dialog showing stale values (LIF-118), the dashboard total summing only
the five visible rows (LIF-114), a `setInterval` leak in the verification banner (LIF-119).
These are diagnosed, branched, and sitting there.

## Stage 5 — Onboarding · 2/5

The weakest stage relative to how fixable it is.

**Current state, in full:** land on an empty dashboard, read "No subscriptions yet"
(`Dashboard.tsx:368`), click "Add Subscription", fill in a form. Repeat by hand for every
commitment you have. There is no bulk import, no CSV, no email scan, no bank connection, no
common-service picker, no templates, no progress indicator, and **no defined activation
event**.

**The central design flaw in the journey.** The value proposition is "see everything you are
committed to." The cost of entry is *remembering everything you are committed to* — which is
precisely the problem the user came here because they cannot solve. **The product asks the
user to solve its problem before it will help them.**

## Stage 6 — Usage · 2/5

A tracker is a low-frequency product; that is fine, and it makes the return ritual load-bearing.
Today that ritual is a single email, seven days before renewal
(`server/src/services/renewalReminderService.ts`, deduped per renewal occurrence — the logic
is careful and correct).

**Friction 1 — one channel, one fixed lead time.** `RENEWAL_REMINDER_DAYS` is a server env
var: the team's preference, imposed on every customer. No user control, no digest, no in-app
inbox.

**Friction 2 — push notifications are dead code.** The mobile app requests notification
permission, calls `getExpoPushTokenAsync` (`mobile/lib/pushNotifications.ts`), POSTs to
`/api/auth/device-token`, and the server upserts a `DeviceToken` row. **Nothing ever reads
that table** — there is no Expo push send, no `expo-server-sdk`, and `DeviceToken` is never
queried anywhere in `server/src`. The single most valuable permission a mobile user ever
grants is being spent to write rows to a table that is never read.

## Stage 7 — Support · 1/5

There is no support. Not thin — **absent.**

The Privacy Policy and Terms of Service — the two documents a worried user reads — both tell
them to email **`[contact@paypr.com]`**, square brackets included: a placeholder that was
never filled in (`PrivacyPolicy.tsx:97`, `TermsOfService.tsx:96`). There is no FAQ, no help
centre, no in-app feedback, no bug report path, and no way for a user to tell the team
anything. Sentry catches errors for the team; the user gets nothing.

Per the Privacy Policy, **account deletion is itself handled by "contact us to request
deletion"** — through a contact channel that does not exist. That is a GDPR exposure, not
merely a UX gap.

## Stage 8 — Loyalty · 1/5

Nothing exists: no newsletter, no referral, no review prompt, no NPS, no win-back, no
"you saved $X this year" moment.

Worth noting that the product **generates the raw material for loyalty for free**. It knows
exactly what a user spends and what they cancelled. "You cancelled 3 subscriptions and saved
$47/month" is sitting in the database, unused.

---

## Where the product view is too narrow

The evidence here is unusually clear, so this section is blunt.

**Look at the backlog composition.** The open branches are: TypeScript version alignment,
ESLint 8→9 migration, dependency bumps, a redundant email index, typechecking test files,
token-table garbage collection, `engines.npm` mismatches, moving `typescript` to
devDependencies. This is a serious, disciplined internal-quality programme. It is also almost
entirely invisible to every customer who has ever used Paypr.

Meanwhile: the support address in the legal documents is a placeholder, there is no
analytics, the push pipeline is half-built, and onboarding is a blank page.

The pattern is **"the product is the codebase"** — done is defined as *implemented, typed,
tested, merged*. Three symptoms:

- **Push notifications are "done" and deliver zero value.** Endpoint, service, tests
  (`auth.deviceToken.test.ts`), mobile registration — all shipped. No user has ever received
  a notification. Feature complete, journey incomplete.
- **AI extraction is treated as a feature, not as the onboarding.** It is the fastest path
  from zero to value in the product, parked behind a dialog while the empty state points at a
  manual form.
- **Known customer-facing bugs sit unmerged while dependency bumps land.** `alert()` on a
  destructive action is in production; recharts 2→3 was merged.

The question that is not being asked: **"what does the customer feel between hearing about us
and telling a friend?"** Everything above is what happens when the answer is nobody's job.

---

## The three highest-value improvements

**A precondition on all three:** none of them are verifiable today. A minimal event pipeline
(PostHog or equivalent, roughly ten events, about an afternoon of work) must land first, or no
success metric below can be read. It is folded into Improvement 1 rather than given a slot of
its own, but it is not optional.

Owners are roles, not names — map them to real people.

### 1. Make first value take 60 seconds, not 20 minutes

**Goal.** A new user sees a real, populated dashboard within one session of signing up,
without having to recall their commitments from memory.

Make **receipt/invoice upload the front door of onboarding** rather than a hidden dialog. The
empty state becomes *"Drop in a receipt, invoice, or a screenshot of your bank statement — we
will read it."* Add a **multi-select picker of the ~30 most common services** (Netflix,
Spotify, iCloud, gym, phone) with prefilled typical costs the user only has to correct. Manual
entry stays as the escape hatch it should be, not the main road.

**Success metric.** *Activation rate*, which must first be defined. Proposed: **% of
registrations with ≥3 subscriptions tracked within 24 hours.** Secondary: median time from
`register` to third subscription. Set a baseline in week one; target 2× within six weeks.

**Owner.** PM defines activation; one full-stack engineer builds. The AI extraction already
exists — this is mostly re-plumbing an existing capability into a new position.

**First small step.** **Instrument before building.** Add events for `register`,
`subscription_added` (with `source: manual | receipt | picker`), and `dashboard_viewed`, then
watch for one week. This reveals what fraction of users add *zero* subscriptions and never
return. That number is the business.

**Risk.** A wrong extraction on the user's very first action damages trust *more than a blank
form does*. Mitigate with the existing `ReviewExtractedDialog` confirmation step — never write
an extracted subscription without the user seeing it first. Second risk: `ANTHROPIC_API_KEY`
is optional and the feature degrades gracefully, so if it is unset in production the new front
door is a dead door. Verify that before anything else.

**How to verify.** A/B the empty state (receipt-first vs. manual-first) on activation rate. If
volume is too low to split-test, ship it and compare two-week cohorts before and after, and
watch the `source` breakdown on `subscription_added` — if receipt-sourced additions do not
become the majority, the front door is not working.

### 2. Make the reminder actually arrive

**Goal.** The surprise charge never happens — which is the entire promise on the landing page.
Today that promise rests on one email at a fixed seven days, and push is dead code.

- **(a)** Build the push *send* path: `expo-server-sdk`, read the `DeviceToken` table that is
  already being filled, fire alongside the existing renewal job, reusing its correct
  per-occurrence dedup.
- **(b)** Let the user choose lead time (1 / 3 / 7 / 14 days) and channel, globally or per
  subscription.
- **(c)** Add a monthly "what is coming and what you are spending" digest — the return ritual
  the product does not currently have.

**Success metric.** Reminder → open → app-open rate within 48h. And the real one: **D30 / D90
retention**, since for a tracker, retention *is* the reminder working.

**Owner.** One backend engineer — the service layer is already the right shape. PM owns the
lead-time defaults.

**First small step.** Ship push *send* for renewal reminders only. Nothing else. The token
table, the dedup logic, and the cron already exist. **Until it sends, every push permission
collected is a promise being broken.**

**Risk.** Notification fatigue earns uninstalls, which is worse than an ignored email. Ship
push as **opt-in with a real preference screen**, not on by default. Stale Expo tokens also
need handling (the push receipts say which rows to delete) or dead tokens will accumulate
silently.

**How to verify.** Compare 30-day retention between users who received ≥1 successful reminder
and those who did not — this is already segmentable from `NotificationLog`. If reminded users
do not retain better, the reminder is not the core loop, and that finding is more valuable
than the feature.

### 3. Open a door the customer can knock on — and stop deleting their data

**Goal.** A user with a problem, a question, or an idea has somewhere to go; and a user who
signed up in good faith never loses their data.

- **(a)** Replace `[contact@paypr.com]` in the Terms and Privacy Policy with a real, monitored
  address on the domain the product actually sends from (`paypr.live`). One hour of work, and
  it is currently a legal exposure: the Privacy Policy routes GDPR deletion requests through a
  channel that does not exist.
- **(b)** Add an in-app feedback affordance — one link, one textarea, straight to an inbox.
- **(c)** Revisit the unverified-account hard delete: **never delete an account that has data
  in it.** Keep the cleanup for genuinely empty junk signups; for a user with ≥1 subscription,
  escalate reminders or archive instead of `deleteMany`.

**Success metric.** Volume of inbound feedback (from zero — any number is a win, and the
*content* is the real deliverable). Plus: **number of accounts-with-data deleted by the
cleanup job, which should be zero.**

**Owner.** PM owns the mailbox and reads every message personally for the first 90 days. One
engineer changes the cleanup job.

**First small step.** **Today:** add logging to `deleteExpiredUnverifiedUsers` recording the
subscription count of every account it deletes. If that number is ever above zero, the product
has been quietly destroying the data of users who did everything right except click a link.

**Risk.** Low, and mostly on the team: a real inbox means real messages that must be answered.
If they will not be answered, do not publish the address. The cleanup change slightly weakens
junk-account protection — acceptable, since an account with subscriptions in it is by
definition not junk.

**How to verify.** Send a support email and confirm it lands. Query for accounts deleted with
data — target zero. Read the feedback: within 30 days the top three themes will say more about
the journey than this document does.

---

## How the product should be run from here

### Data to check

Currently none exists, because none is collected. Start with **four numbers, weekly**:

1. Signups
2. Activation rate (≥3 subscriptions within 24h)
3. D30 retention
4. Reminders successfully delivered

Add a fifth once support exists: inbound messages. Resist dashboard-building — four numbers
that get looked at beat forty that do not. Track the funnel from landing-page view through to
activation; right now not one step of it is visible.

### Questions to ask

- On every ticket, before it is accepted: **"Which stage of the journey does this move, and
  how will we know?"** A ticket that cannot answer is not ready.
- In every review: **"What does the user feel here?"**

The push-token work would not have survived either question.

### Rituals to add

- **Use the product weekly as a new user** — fresh email, no shortcuts, try to reach value.
  The onboarding gap becomes obvious in about four minutes.
- **A monthly journey review** — walk all eight stages, re-rate, and confirm work is scheduled
  in the two weakest, not the most interesting.
- **Read all support mail personally**, unfiltered, for the first 90 days.
- **Watch one real person onboard**, in silence, without helping.

### Remove from the process

- Stop letting internal-quality work default to the top of the queue. The audit backlog is
  real and worth doing — **cap it at ~20% of capacity** and make the rest compete on customer
  impact.
- Stop closing tickets at "merged." A feature is not done until a user has felt it — by which
  standard push notifications are **not done**, and have not been for some time.
- Stop treating the landing page as marketing's problem and the app as engineering's. They are
  the same journey, and one currently promises six item types the other does not have.

### Decide independently

The definition of activation. Reminder defaults and lead times. Which of the ~57 audit issues
are customer-facing enough to jump the queue (`alert()` on a destructive action is; the
redundant email index is not). What the empty state says. **Whether an account with data can
be deleted — decide that one now, and decide "no."**

### Escalate, do not decide alone

**Whether Paypr ever charges money.** Everything in stages 3 and 8 is downstream of that
answer, and the product currently has no mechanism to have one.

---

> **The principle.** The product is not a screen and a set of features. It is the whole
> journey, from first awareness to loyalty. In this codebase the engineering is better than
> the product, and the product is better than the journey. The fastest wins are not features —
> they are a front door that fills itself, a notification that actually sends, and an email
> address a customer can reach.
