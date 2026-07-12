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

### Running a single backend test file

```bash
cd server && npx jest src/__tests__/auth.verification.test.ts
```

### Test database setup

No manual setup — each `npm test` run creates its own throwaway database (`lifeadmin_test_<pid>_<hex>`, derived from `DATABASE_URL` or the default `postgresql://<OS_USER>:@localhost:5432/lifeadmin_test`), migrates it, and drops it on teardown (`src/__tests__/globalSetup.ts` / `globalTeardown.ts`). This makes concurrent jest runs safe. Requires a running Postgres and a role allowed to `CREATE DATABASE`; without that permission the run falls back to the shared `lifeadmin_test` DB (then concurrent runs are unsafe).

> Note: use `prisma:migrate` (not `prisma:migrate:deploy`) for dev work — it creates a shadow DB and handles schema drift.

## Architecture

This is a monorepo with a separate `server/` (Express API) and `client/` (React SPA). They are deployed independently: backend on Railway, frontend on Vercel.

### Auth flow

JWT tokens are issued on login/register and stored as **httpOnly cookies** (not localStorage). The `authenticateToken` middleware (`server/src/middleware/auth.ts`) reads `req.cookies.token`. The frontend axios client (`client/src/lib/api.ts`) sets `withCredentials: true` on every request so cookies are sent cross-origin.

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
| `DISABLE_AUTH_RATE_LIMIT` | Dev only: `true` disables auth rate limiting; ignored (with a warning) when `NODE_ENV=production` |
| `VITE_API_URL`  | Frontend axios baseURL (defaults to `/api` for same-origin proxy)    |
| `VITE_LOGO_DEV_TOKEN` | Brand logos on subscription rows via logo.dev (optional; rows fall back to category icons without it). Publishable client-side token. |

### Database schema highlights

- `User.emailVerified` — users can use the app without verifying, but a banner (`UnverifiedEmailBanner.tsx`) is shown
- `Subscription.isActive` — soft-delete pattern; cancelled subscriptions set `isActive=false`
- `NotificationLog` — append-only log of sent renewal reminder emails; no foreign key to `Subscription` (intentional, subscriptions can be deleted)

## Branch & commit conventions

Branch format: `{type}/{issue-number}-{description}` (e.g. `feature/LIF-42-email-reminders`)

Commit format: `{type}({scope}): {subject}` — present tense, imperative, `Closes #N` footer.
