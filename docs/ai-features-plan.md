> **Status (2026-06-14): Parked — not started.** This is a brainstorm + roadmap + a concrete
> first-milestone implementation plan. No code has been written and the Linear issues described
> at the end have **not** been created yet. Pick this up when ready to build.

# AI Feature Brainstorm — Paypr (Life Admin / Subscription Tracker)

> Goal: map the space of ways AI could be incorporated into the product, with an opinion on what's high-leverage vs. gimmick.

## Context

Paypr today is a **manual subscription ledger**: the user types in each subscription (name, cost, currency, billing cycle, renewal date, category, notes), and the app shows totals (monthly/annual), a category breakdown, upcoming renewals, and sends email renewal reminders. There is currently **zero AI/LLM usage** in the codebase — greenfield.

Two structural weaknesses define where AI has the most leverage:
1. **Manual entry is the dominant friction.** Users won't hand-enter 15 subscriptions. Reducing entry effort is worth more than any analytics feature.
2. **The product is passive.** It reports what you have; it doesn't tell you what to *do*. AI can make it proactive — saving money, not just displaying it.

Data available to feed AI: per-subscription cost / currency / cycle / renewal date / category / free-text name + notes / createdAt; plus derived aggregates (spend by category, upcoming renewals, subscription age) and the notification log.

---

## Tier 1 — Highest leverage (attack the core friction)

### 1. AI-assisted import / "magic add"
The single biggest unlock. Let users get their subscriptions in without typing.
- **Paste-to-parse:** user pastes a bank/card statement (or a forwarded receipt email) → LLM extracts merchant, amount, cadence, currency → pre-fills subscription rows for one-click confirm. Recurring-charge detection (same merchant, regular interval) distinguishes subscriptions from one-off purchases.
- **Forward-an-email inbox:** a dedicated address (e.g. `add@paypr.live`) where users forward "your receipt / your subscription renews" emails; LLM parses and creates the subscription. Leans on existing Resend infra (inbound).
- **Screenshot import:** upload a screenshot of an app-store subscriptions screen or bank app → vision model extracts the list.

*Why Tier 1:* directly removes the reason people abandon trackers. Everything else is more valuable once the data is actually in.

### 2. Smart auto-categorization + enrichment on add
When a user (or import) adds "Netflix", AI fills in the rest:
- Suggests **category** (streaming/fitness/software/other) from the name.
- Suggests **typical cost / billing cycle** and a **logo/brand** to reduce typing.
- Normalizes messy names ("NFLX*NETFLIX.COM" → "Netflix").
*Cheap, high hit-rate, removes form friction. Natural companion to #1.*

### 3. Duplicate & overlap detection
At add-time and on the dashboard:
- "You already track **Netflix** — add anyway?" (fuzzy match on normalized name).
- "You have **3 streaming services** (£35/mo). Most households use 1–2." → overlap/redundancy nudges.
*Turns the list into advice. Concrete money angle.*

---

## Tier 2 — Make it proactive (turn the ledger into a money-saver)

### 4. Spending insights / anomaly digest
LLM-generated natural-language summary over the user's data, surfaced on dashboard + in a periodic email:
- "Your subscriptions rose **18%** since January — driven by 2 new software tools."
- "**£12.99 Disney+** renews in 3 days and you added it 11 months ago — still using it?"
- Price-hike detection (cost field changed between edits).
*Reuses the existing email/cron infra (`emailService`, `jobs/index.ts`) — the renewal-reminder email becomes an AI-written digest.*

### 5. Cancellation / savings recommendations
Opinionated, ranked: "Here's £40/mo you could cut." Flags:
- Low-engagement guesses (old, never-edited, "other" category).
- Annual-vs-monthly arbitrage ("switch to annual, save £24/yr").
- Redundant overlaps (from #3).
Could include a generated **cancellation checklist / email draft** per service.

### 6. Renewal-reminder emails written by AI
Upgrade the existing reminder from a templated line to a short, useful note: groups the next N renewals, totals them, flags anything unusual, suggests "cancel before it renews" with a one-tap link. Low risk — the channel already exists.

---

## Tier 3 — Interaction layer (nice, not foundational)

### 7. Natural-language query / chat over your subscriptions
"What do I spend on software?" / "What renews before payday?" / "Cancel everything I haven't touched in 6 months." LLM translates to a query over the user's data (tool-calling against existing dashboard/subscription endpoints).
*Demo-friendly; lower day-to-day value than Tier 1–2 for a small dataset. Worth it mainly if the dataset gets rich.*

### 8. Forecasting & "what-if"
"Projected spend next 3 months: £X" including known annual renewals landing in the window; "what if I cancel these 3?" live recalculation. Mostly deterministic math; LLM only for the narrative wrapper — could be done without AI.

### 9. Free-text notes assistance
Auto-suggest a note ("shared with family", "work expense — claimable"), or summarize notes across subscriptions. Minor.

---

## Cross-cutting considerations (for whichever we pick)

- **Provider:** Anthropic Claude (per house default). Most features are cheap, high-volume extraction/classification → **Haiku 4.5**; insight/digest narration → **Sonnet 4.6**. Vision (screenshot import) needs a vision-capable model.
- **Privacy / trust:** this is financial data. Decide up front what leaves the DB, get explicit consent for statement/email import, and never auto-cancel — AI suggests, user acts (mirrors the "do not move money" principle).
- **Cost control:** cache enrichment results (brand→category is stable), run digests on the existing daily cron rather than per-request, batch.
- **Architecture fit:** new `aiService` in `server/src/services/` alongside `emailService`; a new controller/route; no schema change needed for insights, but import/enrichment may want a few columns (e.g. `brandSlug`, `source: manual|import`).
- **Guardrails:** structured output (JSON schema / tool use) for anything that creates rows; human confirm step before writes; rate-limit per user.

---

## Recommendation (my opinion)

If the goal is **maximum product impact**, build in this order:
1. **AI-assisted import (#1)** + **auto-categorization (#2)** — kills the adoption-killing friction.
2. **Insights/savings digest (#4 + #5)** delivered through the existing reminder email — makes the product *do* something.
3. Everything else (chat, forecasting) once there's enough data per user to be worth querying.

The "wow" demo is import; the retention driver is the savings digest. Chat is the thing people *ask* for but use least — I'd defer it.

## Open questions (to pick a direction)
- Is the priority **reducing entry friction** (import) or **generating insights** (digests/recommendations)?
- Appetite for **statement/email parsing** (high value, higher privacy + integration cost) vs. staying with **manual-add enrichment** only?
- Build something **shippable & narrow** first, or map a fuller AI roadmap?

---

# DEEP DIVE — Reducing entry friction (the chosen direction)

**Strategic reframe:** the real problem isn't "add subscription is slow" — it's the **empty dashboard on day one**. A new user lands on a blank slate and has to do 15 minutes of data entry before the app gives them anything. **AI import IS the onboarding.** First-run should be "paste your statement / forward your emails" — not an empty form. Getting from 0→populated in one step is the whole activation battle.

## The ladder of import methods (ranked by value × effort × trust)

### A. Manual-add enrichment — *easiest, lowest risk, ship first*
The form stays, but typing one field fills the rest.
- **Name autocomplete from a brand catalog:** start a static catalog of the top ~200 services (Netflix, Spotify, Disney+, Adobe…) with logo, default price by region, typical cycle. LLM is the *fallback* for names not in the catalog.
- **"Fill the rest" button:** user types only a name → LLM returns `{category, typicalCost, billingCycle, brandSlug}` → pre-fills the form for confirm. One field → full row.
- **Name normalization:** "NFLX*NETFLIX.COM" / "PAYPAL *SPOTIFY" → "Netflix" / "Spotify".
- *Model:* Haiku. Cache by normalized name (brand→metadata is stable). Cheap, instant, no new data sources.

### B. Paste / forward parsing — *the big unlock*
- **Statement paste / CSV upload:** user pastes card-statement text (or uploads a bank CSV export) → system finds **recurring charges** and proposes subscription rows.
  - *Core intelligence = recurrence detection:* group by normalized merchant + roughly-constant amount + regular interval (monthly/annual). The math can be deterministic; the LLM's job is the messy-merchant-string normalization and the subscription-vs-one-off judgment ("AMZN MKTP" = shopping, not a sub).
  - Detect **currency** and **cycle** from the cadence of charges.
- **Forward-a-receipt inbox:** dedicated address (`add@paypr.live`); user forwards "your receipt / renews soon" emails → LLM parses one subscription per email. Builds on existing **Resend** infra (inbound email). Trust is high because the user explicitly forwards.
- *Model:* Haiku for extraction (structured/JSON output), volume-friendly.

### C. Vision import — *mobile-first path*
- Upload a **screenshot** of iOS/Android "Subscriptions" settings, the App Store subscriptions screen, or a bank-app transaction list → vision model extracts the list.
- Photo of a **paper bill / gym contract**.
- *Model:* a vision-capable Claude. Higher cost per call but users do it rarely.

### D. Connected accounts (Open Banking / email OAuth) — *highest value, highest cost & trust burden*
- **Plaid / TrueLayer / GoCardless** bank connection → automatic recurring-charge feed. This is the "real" version of import. **AI's role sits on top of the raw feed:** classify which recurring charges are genuine subscriptions, categorize them, dedupe against existing, and detect price changes.
- **Gmail read-only OAuth** → scan inbox for receipts.
- *Reality check:* big integration + compliance + privacy lift. Probably a later milestone, but worth noting the AI layer is the same as B/C — so building B first is a stepping stone, not throwaway.

## What's shared across all import methods (the actual product surface)
- **A review/confirm step is non-negotiable.** Never auto-create rows. Show extracted candidates in a list, per-row toggle + inline edit, then bulk-confirm. This is most of the UX work.
- **Confidence signaling:** flag fields the model was unsure about so the user knows where to look.
- **Free-trial handling:** "this is a £0 trial that becomes £9.99 on 14 Mar" → auto-set renewalDate + a "cancel before charge" reminder. (High-value sub-feature — trials that silently convert are exactly what users want caught.)
- **Dedupe on import:** match against existing subscriptions (ties back to overlap detection #3).
- **Provenance:** likely want a `source: manual | paste | email | screenshot | bank` column so the UI can show how a row got there.

## Suggested build order within this direction
1. **A — manual-add enrichment** ("fill the rest" + name normalization). Smallest, safe, immediately useful, builds the `aiService` + brand-metadata plumbing everything else reuses.
2. **B — statement/CSV paste → review screen.** The headline feature. Reuses the enrichment + confirm UI.
3. **B — forward-email inbox** (incremental on Resend).
4. **C — screenshot import.** Once the review screen exists, vision just feeds the same pipeline.
5. **D — bank connection.** Separate milestone; AI layer already proven by 1–4.

---

# BROADER IDEA SPACE

Net-new ideas beyond the three tiers above:

- **Free-trial / "cancel before you're charged" tracker** — arguably its own headline feature; AI extracts trial-end + first-charge from receipts. Pairs with import.
- **Price-change history & hike alerts** — store cost over time; AI flags "Disney+ £7.99 → £9.99". Needs a price-history table.
- **Zombie-subscription detector** — "never edited in 14 months, 'other' category — still using it?" Pure heuristic + AI explanation.
- **Tax / expense tagging** — AI suggests which subscriptions are work-claimable; export a claimables report.
- **Household / shared-plan detection** — "this is a family plan — split the cost?" → per-member view.
- **Lightweight natural-language quick-add** — "add gym fifty quid monthly" parsed into a row (much lighter than full chat; great mobile input).
- **Inbound channels: WhatsApp / SMS add** — text the bot to add or query a sub.
- **Subscription "bill audit" score** — one health number + an AI paragraph explaining it; a shareable hook.
- **Better-deal / plan-optimizer** — "Spotify Duo would save you £X" (needs a deals catalog; riskier, can be wrong — flag as exploratory).
- **Renewal-date inference** — when the user doesn't know the date, infer from category/typical billing.

---

# NEW DIMENSIONS — question the "AI as a bolt-on" frame

## I. The product name is bigger than the product: "life admin," not just subs
It's called **Paypr / Life Admin App** but only tracks subscriptions. AI is the engine that lets it grow into the name **without building a bespoke parser per category.** One extraction pipeline can ingest *any recurring commitment*:
- Utility & phone bills, insurance renewals, mortgage/rent, council tax
- Domain/hosting renewals, software licenses
- Warranties & guarantees (expiry tracking), memberships, season tickets
- Contracts with notice periods ("cancel by X or auto-renews 12 months")
AI reads a document/email and decides *what kind of commitment it is* and *what matters about it* (renewal, notice period, amount, cancellation route). **This is the strongest strategic case for AI here:** it's what turns a single-purpose tracker into a general life-admin assistant, and the moat is the extraction quality, not the schema.

## II. The agentic frontier — do the admin, don't just track it
The current product *informs*; competitors (Rocket Money, Trim) *act*. AI's endgame here is an **agent that handles the chore**:
- **Drafts the cancellation** — generates the email/letter/script per provider, with the notice-period deadline baked in.
- **Concierge cancel/negotiate** — with explicit per-action consent, an agent contacts the provider. *Huge value, huge risk* — must stay opt-in, human-confirmed, and never auto-spend (mirrors the "never move money" rule). This is the premium-tier story.
- **"Cancel before charge" autopilot** — for trials, the agent prepares everything and pings the user one tap from done.
*Frame: the differentiator isn't insight, it's offloading the admin.*

## III. AI as the interface, not a screen — channel-native
For a low-frequency utility, the best UI may be **no UI**: live in **WhatsApp / iMessage / SMS**, where AI is the entire interaction. "Forward me receipts, I'll track them; I'll text you before anything renews; reply CANCEL and I'll handle it." Removes the "remember to open the app" problem that kills trackers. The DB + extraction pipeline stay the same; the surface changes.

## IV. Data network effects — benchmarking across the user base
Once enough users exist, **anonymized aggregates** become a feature only AI/data can offer:
- "People who track Netflix pay £10.99 on average — you're on £15.99 (you may be on an old plan)."
- "Households like yours spend £42/mo on streaming; you're at £71."
- Cluster users to personalize the savings advice.
*Requires care: privacy-preserving aggregation, k-anonymity, opt-in. But it's a defensible, compounding asset.*

## V. Business-model lens — what AI justifies charging for
Free tier = manual tracking + reminders (today's product). **AI is the paywall:**
- Paid: import/enrichment, savings digests, concierge cancel, benchmarking.
- Aligns cost (LLM/API spend) with revenue, and gives a concrete upgrade pitch ("we found £40/mo you can cut — unlock to act on it").

---

# HONEST PRESSURE-TEST — where AI is the *wrong* tool here

Brainstorming isn't just adding ideas; it's killing the weak ones.
- **Forecasting / what-if:** deterministic math. Wrapping it in an LLM adds latency, cost, and hallucination risk for ~no gain. **Skip the AI; just compute it.**
- **Natural-language chat (#7):** for a dataset of ~15 rows, users get answers faster by *looking*. Demos well, retains poorly. **Defer.**
- **Notes assistance (#9):** gimmick. Cut.
- **Plan optimizer / "better-deal finder":** needs an always-current external pricing catalog; LLMs **hallucinate plan details and prices** → erodes trust fast on financial advice. Only viable with a real, maintained deals dataset — otherwise **don't ship it.**
- **Generic insight digests:** if the AI summary is bland ("you have 12 subscriptions"), it reads as spam and trains users to ignore the email. The bar is **specific + actionable or don't send.** Quality, not cadence.
- **General caution:** every AI write-path needs a human-confirm step; every dollar-figure the AI states must be grounded in the user's actual data, never invented; financial-advice tone needs hedging. Trust is the whole game in a money app — one confident wrong number costs more than ten good insights earn.

## Where this leaves the strongest bets
1. **Import / extraction pipeline** (rungs A→D) — the foundation; also the thing that unlocks dimension I (life-admin expansion) and II (agentic cancel).
2. **Free-trial "cancel before charge"** — concrete, high-trust, demo-able.
3. **Concierge cancellation** — the premium differentiator, once extraction is solid.
Weakest / cut: chat, AI-forecasting, notes, unbacked deal-finder.

---

# ROADMAP — sequenced by impact vs. effort

**Guiding logic:** one extraction/AI pipeline is the spine. Build it small first (enrichment), grow it into the headline (import), then layer the high-value/high-risk bets (agentic cancel, life-admin expansion) on top. Each phase reuses the last — nothing is throwaway.

### Phase 0 — Foundation *(prereq, tiny)*
`aiService` in `server/src/services/` (alongside `emailService`), Claude client, structured/JSON-schema output helper, a brand-metadata catalog (~200 services), per-user rate limiting, consent + "AI never auto-acts" guardrail baked in. Everything below depends on this.

### NOW — ship to learn *(low effort, real value)*
| Feature | Impact | Effort | Notes |
|---|---|---|---|
| **Rung A — manual-add enrichment** ("fill the rest" + name normalization) | Med-High | **Low** | Builds the spine; instantly removes form friction; Haiku + cache. **Start here.** |
| **AI-upgraded renewal email** (groups renewals, totals, flags oddities) | Med | **Low** | Reuses existing cron + Resend; *only if it clears the "specific or don't send" bar*. |

### NEXT — the headline & the paywall *(defines the product)*
| Feature | Impact | Effort | Depends on |
|---|---|---|---|
| **Rung B — statement/CSV paste → recurrence detection → review screen** | **High** | Med-High | Phase 0 + the confirm UI. *The feature.* |
| **Free-trial "cancel before charge" tracking** | High | Med | Import + reminders. High-trust, demo-able. |
| **Forward-a-receipt email inbox** | Med-High | Med | Resend inbound; rides the same parser. |
| **Specific savings / cancellation recommendations** | High | Med | Rich data from import; first real **paid-tier** feature. |

### LATER — big bets *(high effort and/or risk; need scale or compliance)*
| Feature | Impact | Effort | Gate |
|---|---|---|---|
| **Rung C — screenshot/vision import** | Med-High | Med | Cheap once the review screen exists; mobile path. |
| **Concierge cancellation (agentic)** | **High** | **High** | The premium differentiator; ops + consent + risk model. |
| **Life-admin expansion** (bills, insurance, warranties, contracts via same pipeline) | **High** | High | Extraction maturity; the "grow into the name" bet. |
| **Rung D — bank connection (Plaid/TrueLayer)** | High | High | Compliance/privacy lift. |
| **Benchmarking / network effects** | Med-High | Med | Needs user scale + privacy-preserving aggregation. |
| **Channel-native (WhatsApp/SMS)** | Med | Med-High | Surface bet once pipeline + agent exist. |

### CUT / DEFER
NL chat (defer to scale) · AI forecasting (use plain math) · notes assistance (cut) · unbacked deal-finder (cut unless real deals dataset).

### Monetization overlay
- **Free:** manual tracking + reminders (today) + light enrichment.
- **Paid:** import, free-trial autopilot, savings recommendations, concierge cancel, benchmarking. Pitch = *"we found £X/mo to cut — unlock to act."*

### Recommended first concrete milestone
**Phase 0 + Rung A enrichment.** Smallest shippable slice that proves the AI plumbing, delivers visible value, and de-risks the bigger import work — without touching bank data or compliance. Everything else builds on it.

---

# ✅ IMPLEMENTATION PLAN — Milestone 1: Phase 0 + Rung A enrichment ("Autofill with AI")

> **Not yet started.** The Linear issues listed at the end have not been created.

## Context
Paypr's add-subscription form is all-manual: the user types name, cost, currency, billing cycle, renewal date, category. This milestone adds one button — **"Autofill with AI"** — next to the name field. The user types "Netflix", clicks it, and the form pre-fills **category + billing cycle + typical cost + normalized name** to confirm/edit. Smallest slice that (a) proves the AI plumbing, (b) removes real form friction, (c) is the reusable foundation (`aiService` + brand catalog) every later import feature builds on. No bank data, no schema migration, no compliance surface.

## Model & API decisions (grounded in the claude-api reference)
- **Model:** `claude-haiku-4-5` — cheap/fast extraction ($1/$5 per 1M tokens, 200K ctx). No `effort`/`thinking` (Haiku doesn't support `effort`).
- **SDK:** `@anthropic-ai/sdk` (TypeScript), new server dependency; `client.messages.create({...})`.
- **Structured output via forced tool use:** one tool `record_enrichment` with `strict: true` + `tool_choice: { type: "tool", name: "record_enrichment" }`; read the `tool_use` block's `.input`. Its `input_schema` constrains `category` to an `enum` of the 8 backend category ids and `billingCycle` to the 5 valid cycles, so the model can't return an invalid value. Parse `block.input` as an object (never string-match).

## Backend (`server/`)
1. **`aiService.ts`** (new, `server/src/services/`, mirrors `emailService.ts`):
   - Conditional client: `const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic(...) : null;` — graceful skip when the key is absent (exactly like `emailService` handles a missing `RESEND_API_KEY`).
   - Named export `enrichSubscription(name): Promise<EnrichmentResult>`, `EnrichmentResult = { normalizedName: string; category: string; billingCycle: string; suggestedCost: number | null; confidence: 'high'|'medium'|'low'; source: 'catalog'|'ai'|'none' }`.
   - **Catalog-first:** check `brandCatalog.ts` (new — ~30–40 top services → `{normalizedName, category, billingCycle, typicalCost}`) by normalized name. Hit → instant, free, deterministic (`source:'catalog'`). Miss → Haiku forced-tool call. No key / model error → `{ source:'none', confidence:'low', ... }` so the form falls back to manual.
   - Leave **currency** untouched (model-guessed currency is noise — keep the form default).
2. **Endpoint** `POST /api/subscriptions/enrich` — route in `routes/subscriptions.ts` + `enrichSubscription` handler in `subscriptionController.ts`. Auth via existing `authenticateToken`; validation `body('name').trim().notEmpty()` (reuse the express-validator pattern in this file); lightweight **per-user rate limit** to bound LLM cost (small in-memory throttle; `express-rate-limit` optional).
3. **Config:** read `ANTHROPIC_API_KEY` (optional — do *not* add to the required-env list in `src/index.ts`; mirror optional `RESEND_API_KEY`). Document in `CLAUDE.md` env table + `.env.example`.

## Frontend (`client/`)
4. **`subscriptionApi.enrich(name)`** in `client/src/lib/subscriptions.ts` → `POST /subscriptions/enrich`, plus an `EnrichmentResult` type.
5. **`AddSubscriptionDialog.tsx`:** a small **"✨ Autofill"** button (lucide `Sparkles`) next to the name input. On click: loading → `enrich(name)` → pre-fill `category`, `billingCycle`, `cost`, normalized `name` in the existing `useState` formData (leave `currency`). Show an unobtrusive "AI suggested — please confirm" hint with confidence. User edits before submit (human-confirm; nothing auto-saved). Explicit button (not on-blur) keeps consent clear and bounds calls.

## Category alignment (small but required)
Frontend `categories` has `cloud-storage` + `news`; backend authoritative list (`categoryController.ts`) uses `cloud` and has no `news`. The AI enum must match the **backend** 8 (`streaming, fitness, software, music, cloud, gaming, productivity, other`) — align the frontend list to it, or AI categories won't map to a form option.

## Tests (`server/src/__tests__/`, Jest — follow `emailVerificationService.test.ts`)
- `aiService`: catalog hit is deterministic (no network); AI path with the Anthropic client **mocked** to return a `tool_use` block → asserts parsed shape + category ∈ valid set; no-key path returns `source:'none'`.
- Endpoint (supertest): `400` on empty name; `200` + well-formed body on valid name (service mocked).

## Verification (end-to-end)
1. `cd server && npm run dev`; `cd client && npm run dev`.
2. Add Subscription → type "Netflix" → **Autofill** → category=streaming, cycle=monthly, a cost, normalized name appear; edit + save works.
3. Unset `ANTHROPIC_API_KEY`: known brands still autofill from the catalog; unknown name returns gracefully (no crash), form stays manual.
4. `cd server && npm test` green.

## Linear issues to create (team LIF · project "Life Admin App MVP") — NOT yet created
- **Parent (epic):** "AI subscription enrichment — Phase 0 + Rung A (Autofill with AI)" — label `Feature`.
- **Sub 1:** Phase 0 — `aiService` + `@anthropic-ai/sdk` + `ANTHROPIC_API_KEY` config + `brandCatalog.ts` (Haiku, forced-tool structured output).
- **Sub 2:** Backend `POST /api/subscriptions/enrich` — route + controller + validation + per-user rate limit.
- **Sub 3:** Frontend "✨ Autofill" in `AddSubscriptionDialog` + `subscriptionApi.enrich` + `EnrichmentResult` type.
- **Sub 4:** Align frontend `categories` to the backend's 8 authoritative ids.
- **Sub 5:** Tests (aiService catalog/AI/no-key + endpoint validation) + docs (`CLAUDE.md` env table, `.env.example`).
