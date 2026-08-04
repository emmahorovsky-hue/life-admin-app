# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (`server/`)

```bash
npm run dev            # Start dev server with nodemon + tsx (port 3001)
npm run build          # Compile TypeScript to dist/
npm run test           # Run Jest tests (needs local Postgres; creates a per-run DB — see below)
npm run test:watch     # Jest in watch mode
npm run test:coverage  # Coverage report
npm run prisma:migrate   # Apply migrations (dev, creates shadow DB)
npm run prisma:generate  # Regenerate Prisma client after schema changes
npm run prisma:studio    # Open Prisma Studio GUI
npm run seed             # Seed database with test data
```

### Frontend (`client/`)

```bash
npm run dev      # Vite dev server (port 3000)
npm run build    # tsc + vite build
npm run lint     # ESLint (max-warnings 0 — any warning fails)
npm run test:unit      # Vitest unit tests (jsdom)
npm run test:unit:watch # Vitest in watch mode
npm run test:e2e # Playwright e2e tests (builds and previews the production bundle on port 4173; needs the backend on 3001 for the /api proxy — see below)
```

### Mobile (`mobile/`)

```bash
npm run start    # Expo dev server (Metro)
npm run ios      # Expo dev server + open iOS simulator
npm run android  # Expo dev server + open Android emulator
npm run web      # Expo dev server for web
```

### Running a single backend test file

```bash
cd server && npx jest src/__tests__/auth.verification.test.ts
```

### Running the e2e suite

Playwright owns the frontend itself (`webServer` in `client/playwright.config.ts` runs `npm run build && npm run preview` on 4173, so e2e exercises the real production bundle). You supply the backend on 3001 — **start it with both rate limiters off**:

```bash
cd server && DISABLE_AUTH_RATE_LIMIT=true DISABLE_RATE_LIMIT=true npm run dev
```

Without that flag the last two auth specs (`Session Persistence › user stays logged in after page refresh`, `Logout › user can logout`) fail on a clean checkout. Each test registers a fresh user, and by the end of the run the auth limiter rejects `/api/auth/register`; the tests surface it as "expected `/dashboard`, got `/register`", which reads exactly like an auth regression but is ordering-dependent — the same tests pass in isolation. **Before debugging an e2e auth failure, grep the backend log for `auth.rate_limit.exceeded`.** The flag is safe to keep in `server/.env`: `routes/auth.ts` ignores it when `NODE_ENV=production`.

**There are two limiters, and `DISABLE_AUTH_RATE_LIMIT` only switches off one of them.** The other is the coarse backstop mounted on the whole API (`app.use('/api', apiLimiter)` in `index.ts`), which defaults to **1000 requests per 15 minutes** and is disabled by `DISABLE_RATE_LIMIT`. It buckets by **authenticated user**, falling back to IP only for requests without a valid token (LIF-240), and each bucket is further **split into four route groups** — `session` (`/auth/me`, `/auth/login`, `/auth/logout`), `device` (`/auth/device-token`), `auth` (the rest of `/api/auth/*`) and `app` (everything else) each get their own budget, so a client looping on one endpoint can no longer 429 the user's data screens *or* lock them out of signing back in. The scope is matched **lowercased**: Express routes `/API/auth/…` to the auth router just like the canonical spelling, and a case-sensitive comparison filed it under `app`. In e2e that means the anonymous registration calls share one `ip:…:auth` bucket while each logged-in test user gets its own `user:…:app` one. A couple of back-to-back runs against one long-lived server can still trip it, and once tripped it stays tripped for the rest of the window, so the *next* run fails from its very first registration.

It presents differently from the auth limiter: every `/api/*` call in the affected group returns 429 with `RATE_LIMIT_EXCEEDED`, and it writes **`api.rate_limit.exceeded`**, not `auth.rate_limit.exceeded` — so the grep above comes back empty even though the backend is fine. Grep for `"type":"security_event"` to catch either. That line names the `route` and whether the bucket was `user_bucket` or `ip_bucket`, and is emitted **once per bucket per minute**, not once per rejected request — a tripped limiter rejects everything for the rest of its window, and logging each rejection buries the signal. Confirm it with `curl -s -o /dev/null -w '%{http_code}' localhost:3001/api/auth/me` — a 429 on an unauthenticated request that should be a 401 is the tell. Restarting the server clears it (the counter is in memory), but running with `DISABLE_RATE_LIMIT=true` avoids it entirely. Both flags are ignored when `NODE_ENV=production`, and both are inert under `NODE_ENV=test`. `API_RATE_LIMIT_MAX` / `API_RATE_LIMIT_WINDOW_MS` tune the ceiling if you'd rather raise it than remove it.

A new e2e spec that registers an account and then touches the app chrome needs to opt out of first-run onboarding (LIF-220): the wizard opens over the dashboard for any empty account and its overlay intercepts clicks on the sidebar, logout included. `e2e/auth.spec.ts` shows the pattern — seed `paypr.onboarding.v1` with `status: 'done'` via `page.addInitScript` before the app boots.

Playwright also pins an exact chromium build, so bumping `@playwright/test` makes every e2e test fail to launch (`Executable doesn't exist at …`) until you run `npx playwright install chromium`.

### Test database setup

No manual setup — each `npm test` run creates its own throwaway database (`lifeadmin_test_<pid>_<hex>`, derived from `DATABASE_URL` or the default `postgresql://<OS_USER>:@localhost:5432/lifeadmin_test`), migrates it, and drops it on teardown (`src/__tests__/globalSetup.ts` / `globalTeardown.ts`). This makes concurrent jest runs safe. Requires a running Postgres and a role allowed to `CREATE DATABASE`; without that permission the run falls back to the shared `lifeadmin_test` DB (then concurrent runs are unsafe).

> Note: use `prisma:migrate` (not `prisma:migrate:deploy`) for dev work — it creates a shadow DB and handles schema drift.

## Architecture

This is an npm-workspaces monorepo with four workspaces (see the root `package.json`):

- `server/` — Express API, deployed on Railway
- `client/` — React SPA (Vite), deployed on Vercel
- `mobile/` — Expo (React Native) app using expo-router; builds are configured via EAS (`mobile/eas.json`)
- `packages/shared` — the `@life-admin/shared` package: TypeScript types, utils (subscription status, currency, timeline, password), and constants shared across the workspaces. It **builds** to `dist/` (CommonJS + `.d.ts`) via `tsc -p tsconfig.build.json`. The build runs automatically on `npm install` / `npm ci` through the package's `prepare` script, so `dist/` always exists after an install — it is gitignored, never committed. CommonJS is deliberate: the server compiles with `module: "commonjs"` and could not consume the raw-TypeScript package this used to ship (LIF-157).

  The three consumers resolve it three different ways — worth knowing before touching `main`/`exports`:
  - **client** — bypasses the package: `vite.config.ts` aliases `@life-admin/shared` directly to `../packages/shared/src/index.ts`, so it compiles from source and keeps HMR on shared edits.
  - **mobile** — Metro honours package `exports` (`unstable_enablePackageExports`), so it consumes `dist/`. Editing shared during mobile dev needs a rebuild: `npm run build:watch --workspace=packages/shared`.
  - **server** — plain `tsc` / Node, consumes `dist/` via `main` + `types`.

Server and client are deployed independently; the mobile app talks to the same API (base URL from `mobile/eas.json` / `app.config.ts`, falling back to `http://localhost:3001/api` in dev).

### Auth flow

JWT tokens are issued on login/register and delivered both ways: set as an **httpOnly cookie** and returned in the JSON response body. The `authenticateToken` middleware (`server/src/middleware/auth.ts`) prefers an `Authorization: Bearer <token>` header and falls back to `req.cookies.token`.

- **Web** uses the cookie: the axios client (`client/src/lib/api.ts`) sets `withCredentials: true` on every request so cookies are sent cross-origin.
- **Mobile** can't rely on cookies: it stores the token from the response body in **expo-secure-store** (`mobile/lib/storage.ts`) and an axios request interceptor (`mobile/lib/api.ts`) attaches it as a Bearer header (plus an `X-Platform: mobile` header) on every request.

**Session revocation.** The JWT is stateless, so clearing the cookie does not invalidate it. Two nullable `User` columns are the only things that can kill a live token, and `authenticateToken` rejects any token whose `iat` predates the later of them: `passwordChangedAt` (set on password reset/change) and `sessionsValidFrom` (set on logout — LIF-174). Both are floored to whole seconds because `iat` is whole seconds; see the comment in `server/src/utils/jwt.ts` before changing either. Logout is therefore **account-wide**: signing out on one device ends every session. Logout is also unauthenticated and idempotent — it always returns 200, even with a missing or expired token, because clients await it before clearing local state.

Email verification uses a separate `EmailVerificationToken` table. On registration, a 32-byte token is generated, SHA-256 hashed before storage (raw token only travels in the email link), and expires in 24 hours. The verify endpoint lives at `GET /api/auth/verify-email?token=<raw>` and redirects the browser to `/verify-email/success` or `/verify-email/error`.

### Backend request lifecycle

```
Route (routes/) → Middleware (express-validator) → Controller (controllers/) → Service (services/) → Prisma → DB
```

- Routes define validation chains and call controllers
- Controllers handle HTTP concerns (req/res, status codes)
- Services contain business logic (`emailVerificationService`, `emailService`, `accountCleanupService` — auto-deletes unverified accounts after a grace period)
- `server/src/utils/db.ts` exports the singleton Prisma client

### Frontend data flow

`AuthContext` (`client/src/contexts/AuthContext.tsx`) is the single source of truth for the logged-in user. It calls `GET /api/auth/me` on mount. All protected pages are wrapped in `<ProtectedRoute>` which reads from this context. On a 401 from a non-public path, the Axios interceptor in `lib/api.ts` doesn't navigate itself — it notifies subscribers via `onUnauthorized()`; `AuthContext` clears the user and `<ProtectedRoute>` redirects to `/login` with `<Navigate>`, so the redirect stays inside the router and React state survives.

### CORS

The server allows: localhost, any `.vercel.app` subdomain, and the configured `CLIENT_URL` env var. This handles Vercel preview deployments without explicit allowlisting.

### Key env vars

| Var             | Where used                                                           |
|-----------------|----------------------------------------------------------------------|
| `DATABASE_URL`  | Prisma (required, server fails to start without it)                  |
| `JWT_SECRET`    | Token signing (required)                                             |
| `API_URL`       | Included in verification email links (e.g. `http://localhost:3001`)  |
| `CLIENT_URL`    | Two consumers with two different defaults: the CORS allowlist in `index.ts` (default `http://localhost:5173`), and the base of every link in outgoing email via `utils/urls.ts` (default `https://paypr.live`). Unset in production means emails point at `paypr.live` while CORS allowlists a dev port — set it explicitly |
| `RESEND_API_KEY`| Email sending via Resend SDK                                         |
| `ANTHROPIC_API_KEY` | Receipt/invoice AI extraction (optional; feature degrades gracefully without it) |
| `AI_MODEL`      | Claude model id for extraction (optional, defaults to `claude-haiku-4-5`; recommended in production: `claude-sonnet-5` for amount accuracy — see `server/docs/API.md`) |
| `EMAIL_FROM`    | From address on outgoing emails (default `noreply@paypr.live`)       |
| `MOBILE_URL`    | Deep link scheme the verify-email/email-change endpoints redirect *to* when `?platform=mobile` (default `lifeadmin://`). Never put it in an email body — mail clients can't open a custom scheme and no Universal Links are configured (LIF-244) |
| `SENTRY_RELEASE`| Tags Sentry errors by deploy (optional; set in CI/CD)                |
| `ENABLE_CRON`   | Set to `false` to skip scheduling background jobs (default enabled)  |
| `CLEANUP_CRON`  | Cron schedule for unverified-account cleanup (default `0 3 * * *` UTC) |
| `GRACE_PERIOD_DAYS` | Days an account may stay unverified before deletion (default 7)  |
| `WARNING_LEAD_HOURS`| Hours before the deadline the warning email is sent (default 24) |
| `TOKEN_RETENTION_DAYS` | Days a used/expired verification/reset/email-change token row is kept before the daily sweep deletes it (default 30). Not zero on purpose — the consume paths report `already_used`/`expired` rather than `invalid`, which needs the row to still exist. |
| `DISABLE_AUTH_RATE_LIMIT` | Dev only: `true` disables the tighter per-endpoint **auth** limiters (`routes/auth.ts`); ignored (with a warning) when `NODE_ENV=production` |
| `DISABLE_RATE_LIMIT` | Dev only: `true` disables the **general** per-IP API limiter mounted on all of `/api` (`middleware/rateLimit.ts`); ignored (with a warning) when `NODE_ENV=production`. Separate from the flag above — e2e runs need both |
| `API_RATE_LIMIT_MAX` / `API_RATE_LIMIT_WINDOW_MS` | General limiter ceiling and window (defaults 1000 / 15 min, per authenticated user per route group — `session`/`device`/`auth`/`app`; per IP when there's no valid token) |
| `SENTRY_DSN`    | Error reporting (optional, but production without it reports nothing — a client bug that spent a user's whole rate-limit budget went unnoticed for exactly this reason) |
| `TRUST_PROXY_HOPS` | Reverse-proxy hops in front of Express, i.e. how much of `X-Forwarded-For` to unwind for `req.ip` (default 2 in production for Vercel → Railway, else 1). Wrong values silently poison rate-limit buckets and the security audit log — see LIF-240 |
| `LOG_PROXY_DIAGNOSTIC` | Set to `true` to log the raw `x-forwarded-for` next to the resolved `req.ip` for the first 20 requests, to verify `TRUST_PROXY_HOPS` against the real edge chain |
| `VITE_API_URL`  | Frontend axios baseURL (defaults to `/api` for same-origin proxy)    |
| `VITE_LOGO_DEV_TOKEN` | Brand logos on subscription rows via logo.dev (optional; rows fall back to category icons without it). Publishable client-side token. |

Mobile reads its own env at build time in `mobile/app.config.ts`, which surfaces the
values under `expo.extra` — nothing in `mobile/` sees `process.env` at runtime. Copy
`mobile/.env.example` to `mobile/.env` for local dev; for EAS builds see DEPLOYMENT.md
Part 6.

| Var (mobile)    | Where used                                                           |
|-----------------|----------------------------------------------------------------------|
| `API_URL`       | Baked into the binary as `extra.apiUrl`; `lib/api.ts` falls back to localhost only under `__DEV__`, and a production build without it throws during config |
| `LOGO_DEV_TOKEN`| Brand logos on subscription rows via logo.dev, as `extra.logoDevToken` (read by `lib/subscriptionLogo.ts`). Same publishable token as the web `VITE_LOGO_DEV_TOKEN`. Optional; rows fall back to category icons without it. Not committed — the repo is public |
| `SENTRY_DSN`    | Crash/error reporting, as `extra.sentryDsn` (read by `lib/sentry.ts`). Optional — no DSN means Sentry never initialises — but a **production** build without it warns, since an unreported release hides its own failures. Not committed, same reason as the logo.dev token. See DEPLOYMENT.md 6.3 |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Source-map upload. **Unlike the DSN these are not safely omittable: without them the iOS build fails**, because the `@sentry/react-native` plugin runs `sentry-cli` unconditionally in an Xcode build phase (`XCODE_BUILD_ERROR` … `An organization ID or slug is required`). Set `SENTRY_DISABLE_AUTO_UPLOAD=true` on EAS to skip the upload and ship without symbolication; it applies per environment (`eas env:list`), and is meant to come back out once the trio is set. See DEPLOYMENT.md 6.3 |

### Database schema highlights

- `User.emailVerified` — users can use the app without verifying, but a banner (`UnverifiedEmailBanner.tsx`) is shown
- `Subscription.isActive` — soft-delete pattern for **DELETE** `/api/subscriptions/:id` only: it sets `isActive=false` and the row disappears from queries
- `Subscription.cancelledAt` — **cancel** (`POST /api/subscriptions/:id/cancel`) is not delete: it sets `cancelledAt` and freezes `renewalDate` at the end of the current paid period (`server/src/controllers/subscriptionController.ts`), so the subscription stays active and visible until that date. `POST /api/subscriptions/:id/resume` reverses it by clearing `cancelledAt`. Client-side status (`packages/shared/src/utils/subscription.ts`) derives `active` / `cancelling` / `ended` from `cancelledAt` + the frozen renewal date — it never reads `isActive`
- `NotificationLog` — append-only log of sent renewal reminder emails; no foreign key to `Subscription` (intentional, subscriptions can be deleted)

## Branch & commit conventions

Branch format: `{type}/{issue-number}-{description}` (e.g. `feature/LIF-42-email-reminders`)

Commit format: `{type}({scope}): {subject}` — present tense, imperative, `Closes #N` footer.

## UI & animation skills

`.claude/skills/` holds eight skills from [emilkowalski/skills](https://github.com/emilkowalski/skills), committed so every contributor gets the same set. Install or update them with `npx skills@latest add emilkowalski/skills --skill '*' --copy`; `skills-lock.json` pins the content hashes.

**Read `emil-design-eng` and `apple-design` before writing or changing UI in `client/` or `mobile/`** — any new component, restyle, transition, gesture, or sheet. Skills are loaded on demand rather than at startup, so this instruction is what actually pulls them in; without it they fire only when a task obviously looks like animation work, and most UI tweaks don't.

The rest are on demand, not automatic:

| Skill | Use it when |
|---|---|
| `review-animations` | Judging animations in a diff against a fixed standard |
| `improve-animations` | Auditing existing motion across the app, producing a plan |
| `find-animation-opportunities` | Looking for places that should animate and don't |
| `animation-vocabulary` | Naming a motion effect you can only describe |
| `pick-ui-library` | Choosing a library instead of hand-rolling one |
| `prototype` | Building several versions of a UI to compare |

`pick-ui-library` and `prototype` never self-trigger — ask for them by name.
