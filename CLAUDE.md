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
npm run test:e2e # Playwright e2e tests (spins up the Vite dev server on port 4173; needs the backend on 3001 for the /api proxy)
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

### Test database setup

No manual setup — each `npm test` run creates its own throwaway database (`lifeadmin_test_<pid>_<hex>`, derived from `DATABASE_URL` or the default `postgresql://<OS_USER>:@localhost:5432/lifeadmin_test`), migrates it, and drops it on teardown (`src/__tests__/globalSetup.ts` / `globalTeardown.ts`). This makes concurrent jest runs safe. Requires a running Postgres and a role allowed to `CREATE DATABASE`; without that permission the run falls back to the shared `lifeadmin_test` DB (then concurrent runs are unsafe).

> Note: use `prisma:migrate` (not `prisma:migrate:deploy`) for dev work — it creates a shadow DB and handles schema drift.

## Architecture

This is an npm-workspaces monorepo with four workspaces (see the root `package.json`):

- `server/` — Express API, deployed on Railway
- `client/` — React SPA (Vite), deployed on Vercel
- `mobile/` — Expo (React Native) app using expo-router; builds are configured via EAS (`mobile/eas.json`)
- `packages/shared` — the `@life-admin/shared` package: TypeScript types, utils (subscription status, currency, timeline, password), and constants shared by `client/` and `mobile/`. It ships raw TS source (`main` points at `src/index.ts`); each app's bundler (Vite / Metro) compiles it, so there is no build step for this package.

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
| `CLIENT_URL`    | CORS allowlist                                                       |
| `RESEND_API_KEY`| Email sending via Resend SDK                                         |
| `ANTHROPIC_API_KEY` | Receipt/invoice AI extraction (optional; feature degrades gracefully without it) |
| `AI_MODEL`      | Claude model id for extraction (optional, defaults to `claude-haiku-4-5`)        |
| `EMAIL_FROM`    | From address on outgoing emails (default `noreply@paypr.live`)       |
| `MOBILE_URL`    | Mobile deep link scheme for email redirects (default `lifeadmin://`) |
| `SENTRY_RELEASE`| Tags Sentry errors by deploy (optional; set in CI/CD)                |
| `ENABLE_CRON`   | Set to `false` to skip scheduling background jobs (default enabled)  |
| `CLEANUP_CRON`  | Cron schedule for unverified-account cleanup (default `0 3 * * *` UTC) |
| `GRACE_PERIOD_DAYS` | Days an account may stay unverified before deletion (default 7)  |
| `WARNING_LEAD_HOURS`| Hours before the deadline the warning email is sent (default 24) |
| `TOKEN_RETENTION_DAYS` | Days a used/expired verification/reset/email-change token row is kept before the daily sweep deletes it (default 30). Not zero on purpose — the consume paths report `already_used`/`expired` rather than `invalid`, which needs the row to still exist. |
| `DISABLE_AUTH_RATE_LIMIT` | Dev only: `true` disables auth rate limiting; ignored (with a warning) when `NODE_ENV=production` |
| `VITE_API_URL`  | Frontend axios baseURL (defaults to `/api` for same-origin proxy)    |
| `VITE_LOGO_DEV_TOKEN` | Brand logos on subscription rows via logo.dev (optional; rows fall back to category icons without it). Publishable client-side token. |

### Database schema highlights

- `User.emailVerified` — users can use the app without verifying, but a banner (`UnverifiedEmailBanner.tsx`) is shown
- `Subscription.isActive` — soft-delete pattern for **DELETE** `/api/subscriptions/:id` only: it sets `isActive=false` and the row disappears from queries
- `Subscription.cancelledAt` — **cancel** (`POST /api/subscriptions/:id/cancel`) is not delete: it sets `cancelledAt` and freezes `renewalDate` at the end of the current paid period (`server/src/controllers/subscriptionController.ts`), so the subscription stays active and visible until that date. `POST /api/subscriptions/:id/resume` reverses it by clearing `cancelledAt`. Client-side status (`packages/shared/src/utils/subscription.ts`) derives `active` / `cancelling` / `ended` from `cancelledAt` + the frozen renewal date — it never reads `isActive`
- `NotificationLog` — append-only log of sent renewal reminder emails; no foreign key to `Subscription` (intentional, subscriptions can be deleted)

## Branch & commit conventions

Branch format: `{type}/{issue-number}-{description}` (e.g. `feature/LIF-42-email-reminders`)

Commit format: `{type}({scope}): {subject}` — present tense, imperative, `Closes #N` footer.
