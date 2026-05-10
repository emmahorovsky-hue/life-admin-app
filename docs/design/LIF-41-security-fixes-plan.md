# LIF-41: Security Fixes Implementation Plan

**Author:** CTO Agent
**Date:** 2026-05-09
**Status:** Ready for Engineer
**Source:** [SECURITY_AUDIT_REPORT.md](../../SECURITY_AUDIT_REPORT.md)
**Audience:** Engineer agent (implementation), Anna (sign-off on flagged decisions)

---

## TL;DR

14 vulnerabilities across 4 severity tiers. Plan groups them into **3 sequenced PRs** that
ship in this order so we can deploy safely without breaking the live app:

1. **PR-1 — Hardening (blockers, ~1 day)** — fixes that don't change UX or DB schema.
2. **PR-2 — Auth strengthening (~1–2 days)** — refresh tokens, lockout, password rules.
   Needs DB migration + frontend cooperation.
3. **PR-3 — Observability & ops (~0.5 day)** — logging, dependency scanning, monitoring.

Critical and High items in PR-1 must land before we tell anyone outside Anna's circle
about the app. Mediums can ship in week 2.

---

## Sequencing & PR plan

### PR-1: Hardening (BLOCKER for any external user)
**Branch:** `security/pr1-hardening`
**Estimated:** 4–6 hours
**No DB migration. No frontend changes required.**

| # | Audit ID | Title | Files |
|---|----------|-------|-------|
| 1 | #1 | Fix JWT secret config (fail-fast, remove fallback) | `server/src/utils/jwt.ts`, `server/src/index.ts` |
| 2 | #4 | Add helmet.js with CSP | `server/src/index.ts`, `package.json` |
| 3 | #3 | HTTPS enforcement + HSTS + `trust proxy` | `server/src/index.ts` |
| 4 | #7 | Sanitize error responses in production | `server/src/middleware/errorHandler.ts` |
| 5 | #5 | Global API rate limiting | `server/src/middleware/rateLimit.ts` (new), all `routes/*.ts` |
| 6 | #6 | Bump bcrypt rounds 10 → 12 | `server/src/controllers/authController.ts` (and verification middleware reused) |
| 7 | #14 | CORS: explicit origin allowlist + production verification | `server/src/index.ts` |
| 8 | #2 | CSRF protection (double-submit cookie pattern) | new `server/src/middleware/csrf.ts`, `server/src/index.ts`, frontend `client/src/lib/api.ts` |

> CSRF (#2) is technically the only PR-1 item that requires a frontend change (read CSRF
> cookie, echo header on mutating requests). If we want to land server-only changes
> faster, we can split CSRF into PR-1b. Recommend keeping it together because lax cookies
> are a real risk today.

**Definition of Done for PR-1:**
- App boots fail-fast if `JWT_SECRET` < 32 chars or missing.
- `securityheaders.com` grade ≥ A on the Railway URL.
- `https://app/api/auth/login` rejects HTTP (302 → HTTPS).
- All `/api/*` routes have rate-limit headers (`RateLimit-*`).
- Production error responses contain only `{ message, code }`, no `details`/stack.
- CSRF token enforced on all `POST/PATCH/PUT/DELETE` (except `/api/auth/login`,
  `/register`, `/csrf-token`, `/health`).
- Smoke test green on a Railway preview env before promoting.

---

### PR-2: Auth strengthening
**Branch:** `security/pr2-auth`
**Estimated:** 1–2 days
**Requires DB migration. Requires small frontend changes.**

| # | Audit ID | Title | Notes |
|---|----------|-------|-------|
| 9 | #11 | Refresh tokens (15 min access + 7 day refresh, rotation) | New `RefreshToken` table; new `/api/auth/refresh`, `/api/auth/logout-all` |
| 10 | #9 | Account lockout after failed logins | Add `failedLoginAttempts`, `lockedUntil` to `User`. 5 attempts → 15 min lock; exponential after 3 lockouts. |
| 11 | #10 | Password complexity | min 10 chars, ≥1 upper, ≥1 lower, ≥1 digit. Reject top-1k common passwords (use `zxcvbn` score ≥ 3). |
| 12 | #13 | Input sanitization | `xss-clean` or DOMPurify on output for `notes`/`name`. Belt-and-suspenders with existing validators. |
| 13 | #8 | Session invalidation | Falls out of refresh-token rotation: deleting refresh token = revoking session. Add `/api/auth/sessions` list & revoke. |

**Definition of Done for PR-2:**
- Login returns short-lived access cookie + long-lived refresh cookie.
- `/api/auth/refresh` rotates refresh token on each call (token reuse detection logs out
  all sessions for that user — see *Decision needed #2*).
- 5 wrong passwords for one email → 15-minute lock; UI shows clear message.
- Registration rejects `password123`, `Password1`, etc.
- Notes field with `<script>alert(1)</script>` renders as escaped text in the UI.

---

### PR-3: Observability & ops
**Branch:** `security/pr3-observability`
**Estimated:** 4 hours

| # | Audit ID | Title | Notes |
|---|----------|-------|-------|
| 14 | #12 | Security logging (winston + structured JSON) | Log: login success/fail, lockout, password change, token refresh, refresh-token reuse, 5xx errors. Ship to stdout (Railway aggregates). Optional: Sentry/Logtail later. |
| 15 | #15 | Dependabot + npm audit in CI | `.github/dependabot.yml` + GitHub Action that runs `npm audit --production` weekly. |

---

## Detailed implementation specs

### #1 — JWT secret (Critical)

**File:** `server/src/utils/jwt.ts`

```ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET must be set and >= 32 chars. Refusing to start.'
  );
}
```

**Action items for Engineer:**
1. Generate a fresh 64-char secret: `openssl rand -base64 48`.
2. Set it in Railway env vars (NOT in `.env` committed to git).
3. Audit git history: if the old secret was ever committed, rotate it and force-invalidate
   sessions (see *Decision needed #1*).
4. Delete `JWT_SECRET` line from `.env.example` — replace with placeholder text only.
5. Add `.env` to `.gitignore` (verify already there).

> **🚩 Decision needed #1 (Anna):** If JWT_SECRET was ever committed to public GitHub,
> we must rotate it AND force every existing session to log out. For an MVP with you as
> the only user this is fine; if there are real beta users we should email them first.

---

### #2 — CSRF (Critical)

We use **double-submit cookie pattern** (no server-side session store needed, plays nice
with our JWT cookie auth):

1. Server sets a `csrf-token` cookie (NOT httpOnly, sameSite=`strict`, secure) on every
   GET request.
2. Frontend reads cookie value and sends it back as `X-CSRF-Token` header on every
   mutating request.
3. Middleware verifies header == cookie on `POST/PATCH/PUT/DELETE`.

**Why not `csurf`?** It's deprecated (since 2022). Roll our own ~30 lines or use
`csrf-csrf` package.

**Recommended package:** [`csrf-csrf`](https://www.npmjs.com/package/csrf-csrf) (actively
maintained, signed double-submit).

```ts
// server/src/middleware/csrf.ts
import { doubleCsrf } from 'csrf-csrf';

export const {
  generateCsrfToken,
  doubleCsrfProtection,
  invalidCsrfTokenError,
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!, // separate from JWT_SECRET
  getSessionIdentifier: (req) => req.cookies.token ?? req.ip,
  cookieName: '__Host-csrf',
  cookieOptions: {
    sameSite: 'strict',
    secure: true,
    httpOnly: false, // frontend must read it
  },
  size: 32,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
});
```

Mount in `index.ts` after `cookieParser`:
```ts
app.get('/api/csrf-token', (req, res) => {
  res.json({ token: generateCsrfToken(req, res) });
});
app.use(doubleCsrfProtection);
```

Also flip cookie `sameSite: 'lax'` → `'strict'` in `authController.ts` and
`COOKIE_OPTIONS`.

**Frontend changes:**
- On app load, call `GET /api/csrf-token` once.
- Axios interceptor adds `X-CSRF-Token` header from the cookie on mutating requests.

> **🚩 Decision needed #2 (Anna):** Same-origin frontend (Vercel) and API (Railway) means
> we'll need either (a) a shared root domain + custom domain on both, OR (b) accept
> sameSite=`lax` and rely purely on CSRF tokens. **Recommendation:** Set up
> `app.lifeadmin.dev` (frontend) + `api.lifeadmin.dev` (backend) so cookies can be
> sameSite=`strict` and CSRF works across the same root. ~30 min of DNS work.

---

### #3 — HTTPS enforcement (Critical)

```ts
// server/src/index.ts (early middleware)
app.set('trust proxy', 1); // Railway is behind a proxy

if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
    next();
  });
}
```

HSTS handled by helmet (#4):
```ts
helmet({
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
});
```

**Action items:**
- Set `NODE_ENV=production` in Railway (audit shows it's currently `development`).
- Verify `secure: true` cookies once HTTPS is enforced (already conditional on
  `NODE_ENV === 'production'`).

---

### #4 — Helmet + CSP (High)

```ts
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // tailwind/inline styles
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", process.env.CLIENT_URL!].filter(Boolean),
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // breaks some assets; enable later if not needed
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);
```

CSP applies to API responses too — fine, no script execution there. The frontend on Vercel
needs its own CSP via `vercel.json` headers — separate ticket if not done.

---

### #5 — Global rate limiting (High)

Centralize in `server/src/middleware/rateLimit.ts`:

```ts
import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${(req.body?.email ?? '').toLowerCase()}`,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // 20/min sustained
  standardHeaders: true,
  legacyHeaders: false,
});

export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // POST/PATCH/DELETE per minute
  standardHeaders: true,
  legacyHeaders: false,
});
```

Apply:
- `apiLimiter` globally on `app.use('/api', apiLimiter, ...)`.
- `authLimiter` on `/api/auth/login` and `/api/auth/register` (already there, just move
  here).
- `writeLimiter` on subscription `POST/PATCH/DELETE`.

Note: `keyGenerator` includes the email for auth so attackers can't hit one user from
many IPs without also hitting their per-account lockout (#9).

---

### #6 — Bcrypt rounds 10 → 12 (High)

`bcrypt.hash(password, 12)` everywhere. Existing users keep their 10-round hashes — they
still verify correctly with `bcrypt.compare`. No migration needed.

Optionally: on next successful login, re-hash with 12 rounds and store. (Implement in
PR-2 with refresh tokens.)

---

### #7 — Sanitize error responses (High)

```ts
// server/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger'; // PR-3

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = (req as any).id ?? crypto.randomUUID();
  logger.error({ err, requestId, path: req.path, method: req.method });

  const statusCode = err.statusCode ?? 500;
  const isProd = process.env.NODE_ENV === 'production';

  // Never leak stack/details in prod, regardless of err shape
  const body: any = {
    error: {
      message: isProd && statusCode === 500
        ? 'Internal server error'
        : (err.message ?? 'Internal server error'),
      code: err.code ?? 'INTERNAL_ERROR',
      requestId,
    },
  };

  if (!isProd) body.error.details = err.details ?? err.stack;

  res.status(statusCode).json(body);
};
```

`requestId` returned to the client lets us correlate user reports to logs without
exposing internals.

---

### #9 — Account lockout (Medium → bumped to PR-2)

Add to `User`:
```prisma
failedLoginAttempts Int       @default(0)
lockedUntil         DateTime?
lastFailedLoginAt   DateTime?
```

Logic in login controller:
```
if (user.lockedUntil && user.lockedUntil > now) → 423 Locked
if (password wrong):
  failedLoginAttempts++
  if attempts >= 5:
    lockedUntil = now + min(15min * 2^(lockoutCount-1), 24h)
    failedLoginAttempts = 0
if (password correct):
  failedLoginAttempts = 0
  lockedUntil = null
```

> **🚩 Decision needed #3 (Anna):** Do we email the user on lockout? Recommendation: yes,
> but only after **PR-2 email infrastructure is shipped** (depends on LIF-42). Otherwise
> noisy and easy to abuse for email enumeration. Until then, log internally only.

---

### #10 — Password policy (Medium → PR-2)

```ts
body('password')
  .isLength({ min: 10, max: 128 })
  .matches(/[A-Z]/).withMessage('Need uppercase')
  .matches(/[a-z]/).withMessage('Need lowercase')
  .matches(/[0-9]/).withMessage('Need digit')
  .custom((pw) => {
    const result = zxcvbn(pw);
    if (result.score < 3) throw new Error('Password too weak');
    return true;
  })
```

Add `zxcvbn` (~400KB but bundled server-side only — fine).

Existing users: don't force migration; only enforce on registration and password change.

---

### #11 — Refresh tokens (Medium → PR-2)

**Schema:**
```prisma
model RefreshToken {
  id          String   @id @default(cuid())
  userId      String
  tokenHash   String   @unique // sha256 of opaque random token
  family      String   // rotates together; reuse detection
  expiresAt   DateTime
  revokedAt   DateTime?
  createdAt   DateTime @default(now())
  userAgent   String?
  ipAddress   String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
  @@index([family])
}
```

**Cookies:**
- `access` cookie — JWT, 15 min, `__Host-` prefix, httpOnly, secure, sameSite=strict.
- `refresh` cookie — opaque random (32 bytes), 7 days, `__Host-` prefix, httpOnly, secure,
  sameSite=strict, **path=`/api/auth/refresh`** so it's only sent to the refresh endpoint.

**Endpoints:**
- `POST /api/auth/refresh` — rotate. If presented token is already revoked → revoke
  entire family (reuse detection) → log security event → 401.
- `POST /api/auth/logout` — revoke current refresh token.
- `POST /api/auth/logout-all` — revoke all refresh tokens for user (requires re-auth).
- `GET /api/auth/sessions` — list active sessions (for future settings UI).

**Frontend:** axios interceptor catches 401 → calls `/refresh` → retries original. Standard
pattern.

---

### #13 — Input sanitization (Medium)

Two layers:
1. **Server:** `express-validator` already does `.trim()` and `.normalizeEmail()`. Add
   `.escape()` on `name` and `notes` fields where they're free-text.
2. **Client (defense in depth):** React already escapes by default — just verify nothing
   uses `dangerouslySetInnerHTML` (audit confirms this is clean).

Skip `xss-clean` package — it's deprecated.

---

### #14 — CORS hardening (Medium)

```ts
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? process.env.CLIENT_URL ?? '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // mobile apps, curl, server-to-server
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','X-CSRF-Token'],
  maxAge: 600,
}));
```

Set `ALLOWED_ORIGINS=https://app.lifeadmin.dev,https://www.lifeadmin.dev` in Railway.

---

### #12 — Security logging (Low priority but ship in PR-3)

Use `winston` + JSON formatter. Events to log:
- `auth.login.success`, `auth.login.failure`
- `auth.lockout`
- `auth.password.changed`
- `auth.refresh.rotated`, `auth.refresh.reuse_detected` (CRITICAL alert)
- `auth.csrf.failed`
- `auth.rate_limit.exceeded`
- All 5xx with requestId

Each log line: `{ timestamp, level, event, userId?, ip, userAgent, requestId, ...meta }`.
Railway aggregates stdout — that's enough for now. Sentry/Logtail later.

---

### #15 — Dependency scanning

`.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /server
    schedule: { interval: weekly }
    open-pull-requests-limit: 5
  - package-ecosystem: npm
    directory: /client
    schedule: { interval: weekly }
    open-pull-requests-limit: 5
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: monthly }
```

GitHub Action `audit.yml`:
```yaml
name: npm audit
on: { schedule: [{ cron: '0 9 * * 1' }], workflow_dispatch: }
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd server && npm ci && npm audit --production --audit-level=high
      - run: cd client && npm ci && npm audit --production --audit-level=high
```

---

## Risk register & rollout order

| Risk | Mitigation |
|------|------------|
| CSRF middleware breaks existing client | Ship CSRF endpoint first, deploy client update, then enforce. Or feature-flag with `CSRF_ENFORCE=false` for one deploy. |
| HTTPS redirect breaks Railway healthcheck | Make `/health` exempt from HTTPS redirect, or rely on `x-forwarded-proto` (Railway sets it). |
| Stricter CSP breaks frontend | Test in a Vercel preview before promoting. Start with `Content-Security-Policy-Report-Only` for one deploy. |
| Refresh token migration locks existing users out | Old JWT remains valid for its 7d expiry; new logins use new flow. Or invalidate everyone (Decision #1). |
| Bcrypt rounds 12 slows login | Adds ~150 ms. Acceptable. |

---

## Testing checklist

Each PR ships with:
- [ ] Unit tests for new middleware
- [ ] One integration test per fix (e.g., "POST /subs without CSRF → 403")
- [ ] Manual smoke on Railway preview
- [ ] Lighthouse / securityheaders.com scan after deploy

---

## Open decisions for Anna

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Was JWT_SECRET ever committed to public git? If yes, force logout? | Rotate + force logout. MVP impact minimal. |
| 2 | Stand up `api.lifeadmin.dev` + `app.lifeadmin.dev` to enable sameSite=strict cookies? | Yes — 30 min of DNS work pays off. |
| 3 | Email users on account lockout? | Yes, but only **after** LIF-42 email infrastructure ships. |
| 4 | Force re-hash existing passwords to 12 rounds on next login? | Yes — transparent to user. |
| 5 | Add Sentry now or later? | Later. Stdout logs are enough for MVP. |

---

## Handoff to Engineer

Engineer should:
1. Read this doc + the audit.
2. Open PR-1 first (`security/pr1-hardening`). Don't bundle PR-2 in.
3. Tag me (CTO) on PR-1 review for sign-off before merging.
4. Wait for Anna's call on Decisions #1 and #2 before deploying PR-1.
5. PR-2 and PR-3 can proceed in parallel after PR-1 is in production.

Estimated total: **~3 days of focused work**, plus 1 day for testing/rollout buffer.
