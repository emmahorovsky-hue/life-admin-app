# LIF-47: Email Verification During Sign-up

**Ticket:** [LIF-47](https://linear.app/life-admin-app/issue/LIF-47/implement-email-verification-during-sign-up)
**Author:** CTO Agent
**Date:** 2026-05-11
**Status:** ✅ Ready for Engineer
**Companion doc:** [`LIF-47-email-verification-flow.md`](./LIF-47-email-verification-flow.md) (longer design rationale, decision log)

> This is the canonical implementation spec. Engineer follows the checklist at the bottom.
> The companion `-flow` doc contains additional rationale and Anna's pending decisions —
> read it if you want the "why".

---

## 1. TL;DR

After sign-up, send a one-time verification link to the user's email.

- **Token:** 32 random bytes (256 bits entropy), base64url-encoded in URL, **SHA-256 hashed at rest**.
- **Expiry:** 24 hours, single-use.
- **Gating:** Soft — user can log in unverified but cannot receive reminder emails (LIF-42).
- **Resend:** Always-200 endpoint with rate limiting (anti-enumeration).
- **Email-change resilient:** Tokens carry an email snapshot; if user email changes, prior tokens invalidate.

```
Sign up ─► account created (emailVerified=false, JWT cookie set, user logged in)
          │
          ├─► insert EmailVerificationToken (sha256 hash, 24h expiry)
          └─► send email with link → https://api.lifeadmin.dev/api/auth/verify-email?token=<raw>

User clicks link
          │
          ▼
GET /api/auth/verify-email?token=...
          │
          ├─► hash, lookup, validate (exists, !expired, !used, email matches)
          ├─► User.emailVerified=true, EmailVerificationToken.usedAt=now
          ├─► invalidate other unused tokens for that user
          └─► 302 → ${CLIENT_URL}/verify-email/success  (or /verify-email/error?reason=...)
```

---

## 2. Database schema

### Prisma changes

`server/prisma/schema.prisma`:

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  password        String    // bcrypt hashed
  name            String?
  emailVerified   Boolean   @default(false)   // NEW
  emailVerifiedAt DateTime?                   // NEW
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  subscriptions          Subscription[]
  emailVerificationTokens EmailVerificationToken[]  // NEW

  @@index([email])
}

model EmailVerificationToken {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique          // sha256(raw), hex
  email     String                     // snapshot of user.email at issue time
  expiresAt DateTime
  usedAt    DateTime?                  // null = active; set = consumed/invalidated
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

### Generated SQL migration (`add_email_verification`)

Engineer runs `npx prisma migrate dev --name add_email_verification`. The migration
should produce roughly:

```sql
-- AlterTable: User
ALTER TABLE "User"
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable: EmailVerificationToken
CREATE TABLE "EmailVerificationToken" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key"
  ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_idx"
  ON "EmailVerificationToken"("userId");
CREATE INDEX "EmailVerificationToken_expiresAt_idx"
  ON "EmailVerificationToken"("expiresAt");

ALTER TABLE "EmailVerificationToken"
  ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

### Existing-user grandfather migration (one-shot)

Pending Anna's sign-off on Decision #3 in companion doc. If approved, ship as a
one-shot script `server/prisma/migrations/grandfather_existing_users.sql`:

```sql
UPDATE "User"
SET "emailVerified" = true,
    "emailVerifiedAt" = NOW()
WHERE "createdAt" < CURRENT_DATE;
```

---

## 3. API endpoints

All paths are under `/api/auth`. Existing rate limit (`authLimiter`: 5 req / 15 min)
applies; verification-specific limits below.

### 3.1 `POST /api/auth/register` (modified)

**Behavior change:** after creating the user, issue verification token and send email.
Response shape and status (201) unchanged. Existing JWT cookie still set (soft-gate).

**Response (unchanged shape, new field optional):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "clxxx",
    "email": "anna@example.com",
    "name": "Anna",
    "emailVerified": false,
    "createdAt": "2026-05-11T..."
  }
}
```

**Failure mode:** if email send fails, **do NOT roll back** user creation. Log the
failure and rely on `/resend-verification`. (User has a working account; they can
request another email.)

### 3.2 `GET /api/auth/verify-email?token=<raw>`

Public. No auth required (link works on any device, any browser).

**Validation rules** (in order):
1. `token` query param present and length ≥ 16.
2. SHA-256(token) found in `EmailVerificationToken`.
3. `usedAt` is null.
4. `expiresAt` > now.
5. `EmailVerificationToken.email` equals `user.email` (snapshot check).

**On success** (single transaction):
- `User.emailVerified = true`, `User.emailVerifiedAt = now`
- This token: `usedAt = now`
- All other unused tokens for the same user: `usedAt = now`
- Respond `302 Location: ${CLIENT_URL}/verify-email/success`

**On failure:**
- `302 Location: ${CLIENT_URL}/verify-email/error?reason=<reason>`
- `reason ∈ { invalid, expired, already_used, email_changed }`

**Why 302 and not JSON?** Users open the link in an email client; landing on raw JSON is
terrible UX. The frontend renders the friendly page.

### 3.3 `POST /api/auth/resend-verification`

**Body:** `{ "email": string }` (also accepts cookie-authenticated request — derive from
`req.user.email` if no body).

**Response (always 200, always identical):**
```json
{ "message": "If that email is registered and unverified, we've sent a verification link." }
```

**Internal logic:**
1. Validate email format (return 200 anyway on invalid — anti-enumeration).
2. Look up user by email (normalized lowercase).
3. If user not found OR `user.emailVerified === true` → no-op, return 200.
4. Apply rate limits (see §3.4). If limited → no-op, return 200.
5. Invalidate prior unused tokens, issue new token, send email.

### 3.4 Rate limits (resend-verification)

Three layers, all return generic 200 when tripped:

| Layer | Window | Max | Key |
|---|---|---|---|
| Per email | 60s | 1 | `lowercase(email)` |
| Per email (hourly) | 1h | 5 | `lowercase(email)` |
| Per IP | 1h | 20 | `req.ip` |

Implementation note: `express-rate-limit` `handler` returns 200 with the generic message,
**not** 429, to preserve anti-enumeration.

### 3.5 `GET /api/auth/me` (modified)

Add `emailVerified` and `emailVerifiedAt` to the returned `user` object. Frontend uses
these to render the banner.

---

## 4. Token generation & consumption

`server/src/services/emailVerificationService.ts` (new file):

```ts
import crypto from 'crypto';
import prisma from '../utils/db';
import { sendVerificationEmail } from './emailService'; // from LIF-42

const TOKEN_BYTES = 32;
const EXPIRY_HOURS = 24;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function issueEmailVerificationToken(userId: string, email: string) {
  // Invalidate prior unused tokens (keeps inbox clean & prevents token farming)
  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const raw = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash, email, expiresAt },
  });

  const verifyUrl = `${process.env.API_URL}/api/auth/verify-email?token=${raw}`;
  await sendVerificationEmail({ to: email, verifyUrl, expiresInHours: EXPIRY_HOURS });
}

type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'already_used' | 'email_changed' };

export async function consumeEmailVerificationToken(rawToken: string): Promise<ConsumeResult> {
  if (!rawToken || rawToken.length < 16) return { ok: false, reason: 'invalid' };

  const tokenHash = hashToken(rawToken);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) return { ok: false, reason: 'invalid' };
  if (record.usedAt) return { ok: false, reason: 'already_used' };
  if (record.expiresAt < new Date()) return { ok: false, reason: 'expired' };
  if (record.email !== record.user.email) return { ok: false, reason: 'email_changed' };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.emailVerificationToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true, userId: record.userId };
}
```

**Why opaque random + hash?**
- 256 bits = unguessable.
- Hash at rest = a DB leak does not expose live tokens.
- Opaque (not JWT) = simpler revocation, no info leaks via decode.

**Why `base64url`?** URL-safe, ~43 chars (vs hex's 64), same entropy.

---

## 5. Email template

`server/src/services/templates/verifyEmail.tsx` (new). Uses React Email (already used by
LIF-42) or an HTML string if React Email isn't introduced yet.

**Subject:** `Verify your email for Life Admin App`

**Body (HTML + plaintext fallback):**

```
Welcome 👋

Click the button below to verify your email.
The link expires in 24 hours.

[Verify email]   ← button → ${verifyUrl}

Or paste this URL into your browser:
${verifyUrl}

If you didn't sign up for Life Admin App, you can safely ignore this email.

— Life Admin App
```

Sender: `EMAIL_FROM` (already configured for LIF-42, e.g. `noreply@lifeadmin.dev`).
DKIM/SPF/DMARC configured at the domain level (out of scope for this ticket; assumed from
LIF-42 setup).

---

## 6. Frontend UX flow

### 6.1 After sign-up
User lands on `/dashboard` with a yellow banner at the top:

> 📧 **Verify your email.** We sent a link to **anna@example.com**. [Resend] [Change email]

The banner reads `emailVerified` from `/api/auth/me` and disappears once `true`.

### 6.2 Clicking the email link
1. Email client → `GET https://api.lifeadmin.dev/api/auth/verify-email?token=...`
2. Server redirects (302) to either:
   - **Success:** `${CLIENT_URL}/verify-email/success`
     > ✅ **Email verified.** You're all set. [Continue to app]
   - **Error:** `${CLIENT_URL}/verify-email/error?reason=expired` (or other reason)

### 6.3 Error page copy (by `reason`)

| `reason` | Headline | Body | CTA |
|---|---|---|---|
| `invalid` | Link invalid | This verification link is invalid. | Resend verification |
| `expired` | Link expired | This link has expired. Verification links last 24 hours. | Resend verification |
| `already_used` | Already verified | This email is already verified. | Log in |
| `email_changed` | Link out of date | This link is no longer valid because your email changed. | Resend verification |

### 6.4 Resend behavior
- Banner button → `POST /api/auth/resend-verification` → toast: "Sent — check your inbox."
- Frontend disables the button for 60s after click.
- Server response is always 200; user gets identical feedback regardless of state
  (verified, unknown email, rate-limited).

### 6.5 New frontend routes
- `/verify-email/success`
- `/verify-email/error` (reads `?reason=` query param)

### 6.6 New component
- `<UnverifiedEmailBanner />` at top of authenticated layout when `me.emailVerified === false`.

---

## 7. Security analysis

| Threat | Mitigation |
|---|---|
| Token guessing | 256 bits entropy → cryptographically infeasible. |
| DB leak exposes tokens | Only SHA-256 hash stored. Tokens unusable from leaked DB. |
| Replay (reuse a used token) | `usedAt` set on first use; returns `already_used`. |
| Stale token after email change | Email snapshot mismatch → `email_changed`. |
| Open redirect via `?next=` | We don't accept a redirect target — always fixed `CLIENT_URL`. |
| Email enumeration via resend | Always 200, identical body; rate limits enforced silently. |
| Email enumeration via verify | All failure modes redirect to same `/verify-email/error` route. No "user exists" leak. |
| Spam (mass resend) | Three rate-limit layers (per-email 60s, per-email/hour, per-IP/hour). |
| Token in URL leaks via Referer | Verify endpoint sets `Referrer-Policy: no-referrer` on its response. |
| Token in URL leaks via server logs | Configure access-log middleware to strip `?token=` for `/verify-email`. |
| MITM steals token in transit | HTTPS + HSTS (LIF-41). |
| CSRF on resend | `POST` requires JSON body or CSRF token (LIF-41 setup); cookie SameSite=lax. |
| Premature cookie + unverified = feature bypass | Soft-gate by design. Reminder job (LIF-42) checks `emailVerified` before sending. |
| Phishing | Sender domain DKIM/SPF/DMARC; email footer "If you didn't sign up, ignore." |

### Things we explicitly do NOT do
- ❌ Sign tokens as JWTs (no benefit; opaque is simpler and revocable).
- ❌ Accept email in the verify URL (e.g. `?email=...&token=...`) — invites tampering, adds nothing.
- ❌ Auto-log-in via verify link — link proves inbox control, not password knowledge.

---

## 8. Error handling matrix

### Server-side

| Scenario | HTTP | Body / behavior |
|---|---|---|
| `register` succeeds, email send fails | 201 | User created; log error; do not roll back. |
| `verify-email` token missing | 302 | `→ /verify-email/error?reason=invalid` |
| `verify-email` token not found | 302 | `→ /verify-email/error?reason=invalid` |
| `verify-email` token expired | 302 | `→ /verify-email/error?reason=expired` |
| `verify-email` token used | 302 | `→ /verify-email/error?reason=already_used` |
| `verify-email` email mismatch | 302 | `→ /verify-email/error?reason=email_changed` |
| `verify-email` DB error | 302 | `→ /verify-email/error?reason=invalid` + log |
| `resend-verification` invalid email format | 200 | Generic body (anti-enumeration) |
| `resend-verification` user not found | 200 | Generic body (anti-enumeration) |
| `resend-verification` already verified | 200 | Generic body, no email sent |
| `resend-verification` rate-limited | 200 | Generic body, no email sent |
| `resend-verification` SMTP failure | 200 | Generic body, log error for ops |

### Frontend-side

| Scenario | Behavior |
|---|---|
| Banner visible but `/api/auth/me` returns `emailVerified=true` | Hide banner immediately. |
| Resend button clicked twice in 60s | Frontend-disabled; no second call. |
| User on `/verify-email/success` not logged in | Show "Continue to login" CTA. |
| `?reason=` missing or unrecognized | Default to "invalid" copy. |

---

## 9. Environment variables

Add to `.env` / Railway / Vercel:

```
API_URL=https://api.lifeadmin.dev         # used to build verifyUrl in emails
CLIENT_URL=https://app.lifeadmin.dev      # already set; used for 302 redirects
EMAIL_FROM=noreply@lifeadmin.dev          # already set (LIF-42)
```

Local dev:
```
API_URL=http://localhost:3001
CLIENT_URL=http://localhost:5173
```

---

## 10. Testing strategy

### Unit (`server/__tests__/services/emailVerificationService.test.ts`)
1. ✅ `issueEmailVerificationToken` creates a row with **hashed** token; raw not stored.
2. ✅ Issuing a new token invalidates prior unused tokens for the user.
3. ✅ `consumeEmailVerificationToken` returns `{ ok: true }` for a fresh valid token.
4. ✅ Returns `{ ok: false, reason: 'invalid' }` for unknown tokens.
5. ✅ Returns `{ ok: false, reason: 'expired' }` for tokens past `expiresAt`.
6. ✅ Returns `{ ok: false, reason: 'already_used' }` when `usedAt` set.
7. ✅ Returns `{ ok: false, reason: 'email_changed' }` when snapshot mismatch.
8. ✅ On consume success: user.emailVerified=true, all other unused tokens invalidated.

### Integration (`server/__tests__/routes/auth.verification.test.ts`)
1. ✅ `POST /register` triggers email send (mocked); user row has `emailVerified=false`.
2. ✅ Extract token from mocked email; `GET /verify-email?token=...` → 302 to `/verify-email/success`; user is now verified.
3. ✅ `GET /verify-email?token=garbage` → 302 to `/verify-email/error?reason=invalid`.
4. ✅ Hit a valid token twice → second response redirects with `reason=already_used`.
5. ✅ `POST /resend-verification` for unknown email → 200, no email sent.
6. ✅ `POST /resend-verification` for verified email → 200, no email sent.
7. ✅ `POST /resend-verification` 6 times in an hour → 200 each, only 5 emails sent (per-email hourly cap).
8. ✅ `GET /me` returns `emailVerified` field.

### Manual smoke test (staging)
1. Sign up at `app.lifeadmin.dev` with a real inbox.
2. Receive email within 1 minute. Inspect headers (DKIM/SPF pass).
3. Click link → land on success page. Refresh dashboard → banner gone.
4. Click the same link again → "already verified" page.
5. Sign up a second account; click "Resend" twice rapidly → only one email arrives.
6. Sign up a third account, wait 25h, click old link → "expired" page.

---

## 11. Rollout plan

1. **Branch & PR.** Create `feat/LIF-47-email-verification` off latest `main`.
2. **Schema migration.** `npx prisma migrate dev --name add_email_verification`.
3. **Service code.** Add `emailVerificationService.ts` + unit tests.
4. **Email template.** Add `verifyEmail.tsx` (or HTML helper).
5. **Register hook.** Modify `authController.register` to call `issueEmailVerificationToken` post-create.
6. **Routes.** Add `GET /verify-email`, `POST /resend-verification` with custom rate-limit handlers.
7. **`/me` field.** Add `emailVerified`, `emailVerifiedAt` to `select`.
8. **Frontend.** Banner component, success/error pages, `apiClient.resendVerification`.
9. **Grandfather migration.** Run once after deploy *(pending Anna's Decision #3)*.
10. **Deploy.** Server first (Railway), then client (Vercel). Watch logs through first
    successful verification.
11. **Rollback plan.** Revert PR. Migration is additive (new columns nullable / defaulted),
    so no data loss on rollback.

**Estimate:** 1 day if LIF-42 email infrastructure already in place; 1.5 days if shipped in parallel.

**Dependencies:**
- LIF-42 (`emailService.ts`, Resend integration) should land first or concurrently.
- LIF-41 (cookies/CSRF) should land first so `/resend-verification` POST isn't a CSRF hole.

---

## 12. Implementation checklist (for Engineer)

### Backend
- [ ] Update `server/prisma/schema.prisma`: add `emailVerified`, `emailVerifiedAt` to `User`; add `EmailVerificationToken` model.
- [ ] Run `npx prisma migrate dev --name add_email_verification` and commit migration files.
- [ ] Run `npx prisma generate`.
- [ ] Create `server/src/services/emailVerificationService.ts` with `issueEmailVerificationToken` and `consumeEmailVerificationToken`.
- [ ] Create `server/src/services/templates/verifyEmail.tsx` (or HTML helper) with subject + HTML + plaintext.
- [ ] Modify `server/src/controllers/authController.ts`:
  - [ ] `register`: after `user.create`, call `issueEmailVerificationToken(user.id, user.email)`.
  - [ ] `register` `select`: add `emailVerified`.
  - [ ] `getMe` `select`: add `emailVerified`, `emailVerifiedAt`.
  - [ ] Add `verifyEmail(req, res)` controller that calls service and 302-redirects.
  - [ ] Add `resendVerification(req, res)` controller (always-200).
- [ ] Update `server/src/routes/auth.ts`:
  - [ ] `GET /verify-email` (no auth, no rate limit beyond global).
  - [ ] `POST /resend-verification` with **three** `express-rate-limit` instances, each with a custom always-200 handler.
  - [ ] Add `body('email').isEmail().normalizeEmail()` validation on resend.
- [ ] Configure access-log middleware (if present) to redact `?token=` from `/verify-email` log lines.
- [ ] Set `Referrer-Policy: no-referrer` response header on `/verify-email` route.
- [ ] Add env vars `API_URL` to local `.env.example` and to Railway production env.

### Backend tests
- [ ] Unit tests for `emailVerificationService` (all 8 cases in §10).
- [ ] Integration tests for both routes (all 8 cases in §10).
- [ ] Mock email transport (Resend) and assert payload shape.

### Frontend
- [ ] Add `emailVerified`, `emailVerifiedAt` to user TypeScript type.
- [ ] Add `apiClient.resendVerification(email)` method.
- [ ] Create `<UnverifiedEmailBanner />` component (renders on authenticated layouts when `!emailVerified`).
- [ ] Create `/verify-email/success` page.
- [ ] Create `/verify-email/error` page (reads `?reason=` and renders matrix copy).
- [ ] Disable resend button for 60s after click (local state).
- [ ] Add toast "Sent — check your inbox." on resend.
- [ ] E2E test: sign up → banner appears → simulate click on link → banner disappears.

### Ops / migration
- [ ] **Awaiting Anna's approval (Decision #3 in companion doc):** ship `grandfather_existing_users.sql` to mark pre-launch users verified.
- [ ] Add cleanup cron (optional, defer-able): nightly delete of expired or >30d-used tokens.
- [ ] Verify production DKIM/SPF/DMARC for sender domain (should already be in place from LIF-42).
- [ ] Confirm Resend / SMTP credentials in Railway prod env.

### Docs
- [ ] Update `server/README.md` with new env vars and endpoints.
- [ ] Update `client/README.md` if new pages need callouts.
- [ ] Close LIF-47 with link to PR(s).

---

## 13. Pending decisions (from companion doc)

These were flagged for Anna in `LIF-47-email-verification-flow.md`. Defaults in this spec
assume the **recommended** answer:

| # | Question | Default in this spec |
|---|---|---|
| 1 | Soft-gate vs hard-gate on unverified login? | **Soft-gate** (user can log in, features degrade) |
| 2 | Should the verify link auto-log-in? | **No** |
| 3 | Grandfather existing users to verified=true? | **Yes** (one-shot SQL) |
| 4 | Block reminder emails for unverified users (LIF-42)? | **Yes** (LIF-42 already enforces) |
| 5 | Token expiry 24h? | **Yes** |

If any answer changes, Engineer adjusts the implementation; the schema and core flow are
unaffected by 1, 2, or 5.

---

## 14. Out of scope (for this ticket)

- Magic-link login.
- Email-change flow (re-verification on email update) — separate ticket.
- 2FA / TOTP.
- WebAuthn / passkeys.
- Bulk admin tool for manually verifying users.
