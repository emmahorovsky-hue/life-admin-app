# LIF-47: Email Verification Flow

**Author:** CTO Agent
**Date:** 2026-05-09
**Status:** Ready for Engineer
**Audience:** Engineer agent (implementation), Anna (sign-off on flagged decisions)

---

## TL;DR

After sign-up, send a one-time verification link to the user's email. Link is a 32-byte
random opaque token, hashed before storage, expires in 24 hours, single-use, with
rate-limited resend. Until verified, the user can log in but cannot receive renewal
reminders (LIF-42) and we show a soft banner prompting verification.

```
Sign up ──► account created (emailVerified=false, can log in)
            │
            ├──► insert EmailVerificationToken (sha256 hash, 24h expiry)
            └──► email link: https://app/verify-email?token=<32-byte-base64url>

User clicks link
            │
            ▼
GET /verify-email?token=...
            │
            ├──► token hashed, looked up, validated (expiry, not used, not revoked)
            ├──► User.emailVerified = true, token.usedAt = now
            └──► redirect to /verify-email/success → frontend success page
```

---

## Goals & non-goals

**Goals:**
- Confirm user controls the email address they signed up with.
- Block downstream side-effects (reminder emails) for unverified accounts.
- Resilient to common attacks: token guessing, replay, enumeration, link tampering.
- Good UX: link works on any device, clear error states, easy resend.
- Idempotent verification (clicking the link twice doesn't crash).

**Non-goals (post-MVP):**
- Magic-link login (we keep password auth).
- Email change flow with re-verification (separate ticket).
- 2FA / TOTP.
- "Confirm before login" hard block — we allow login but degrade features. (See *Decision
  needed #1*.)

---

## Architecture decisions

### 1. Opaque random token, hashed before storage
Not a JWT. Reasons:
- JWTs leak info if the link is shared (decode anywhere).
- Short opaque token (32 bytes = 256 bits of entropy) is unguessable, simpler to revoke.
- Storing **only the SHA-256 hash** means a DB leak doesn't expose live tokens.

### 2. Allow login while unverified, soft-gate features
Hard-blocking login on unverified email is hostile UX (and tempts users to give a fake
email). Instead:
- User can log in and use the app.
- Banner: "Verify your email to enable reminders." with resend button.
- LIF-42 reminder job filters on `emailVerified=true` (already specified there).
- Future: gate other features (export, sharing) at our discretion.

> **🚩 Decision needed #1 (Anna):** Confirm soft-gate (login allowed) vs hard-gate
> (must verify before login). Recommendation: **soft-gate**. Hard-gate creates support
> burden ("I never got the email") and we get nothing from it for the MVP feature set.

### 3. 24-hour expiry, single-use
- 24h is the industry standard sweet spot — long enough for users to find the email,
  short enough to limit replay risk.
- Single-use: `usedAt` timestamp set on success. Reuse → 410 Gone.
- Resending the email invalidates all prior tokens for that user (clean inbox state).

### 4. Always-200 resend endpoint (anti-enumeration)
`POST /api/auth/resend-verification` always returns 200, regardless of whether the email
exists, is already verified, or is rate-limited. This prevents email enumeration via
timing or response codes.

---

## Schema changes

```prisma
model User {
  // ... existing
  emailVerified   Boolean   @default(false)
  emailVerifiedAt DateTime?
  emailVerificationTokens EmailVerificationToken[]
}

model EmailVerificationToken {
  id         String   @id @default(cuid())
  userId     String
  tokenHash  String   @unique // sha256(rawToken), hex
  email      String   // snapshot — verifies the email at token-issue time
  expiresAt  DateTime
  usedAt     DateTime?
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
  @@index([expiresAt])
}
```

**Why `email` snapshot?** If a user changes their email later, we don't want a stale
token from the old email to validate the new one.

**Migration:** `add_email_verification`

---

## API surface

### `POST /api/auth/register`
**Modified.** After creating the user, also create a verification token and send the
email. Don't auto-login until verified? See Decision #1 — for soft-gate, we still set
the cookie so the user is logged in.

```ts
// In register controller, after user.create:
await issueEmailVerificationToken(user.id, user.email);
// existing: set cookie, return 201
```

Response unchanged. Frontend shows "Check your inbox to verify."

### `GET /api/auth/verify-email?token=<raw>`
Public endpoint. No auth required (link works from any device).

Behavior:
- Hash the token, look up.
- Validate: exists, not expired, not used, `email` snapshot still matches `user.email`.
- On success: set `emailVerified=true`, `emailVerifiedAt=now`, mark token used, **invalidate
  all other unused tokens for this user**.
- Redirect: `302 → ${CLIENT_URL}/verify-email/success` (or `/error?reason=...`).

Why redirect instead of JSON? Users click the link in their email client → land in a
browser with no JS context. A redirect to a friendly page is better UX than JSON.

> **🚩 Decision needed #2 (Anna):** Should this also auto-log-the-user-in if the link is
> opened in a fresh browser? Recommendation: **no**. The link verifies email; auth still
> requires password. Less attack surface (link sharing doesn't grant access).

### `POST /api/auth/resend-verification`
Body: `{ email: string }` (or rely on cookie if logged in — we'll accept both).

**Always returns 200** with generic body:
```json
{ "message": "If that email is registered and unverified, we've sent a verification link." }
```

Internally:
- Look up user by email.
- If user doesn't exist or already verified → no-op.
- Else: rate-limit (1 send per minute, 5 per hour per email + per IP), invalidate previous
  tokens, issue new token, send email.

### `GET /api/auth/me` (existing)
Add `emailVerified` and `emailVerifiedAt` to the response so frontend can render the
banner.

---

## Token generation

```ts
// server/src/services/emailVerificationService.ts
import crypto from 'crypto';
import prisma from '../utils/db';
import { sendVerificationEmail } from './emailService';

const TOKEN_BYTES = 32;
const EXPIRY_HOURS = 24;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function issueEmailVerificationToken(userId: string, email: string) {
  // Invalidate any prior unused tokens for this user
  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() }, // mark "used" to take them out of play; OR delete
  });

  const raw = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash, email, expiresAt },
  });

  const verifyUrl = `${process.env.API_URL}/api/auth/verify-email?token=${raw}`;
  await sendVerificationEmail({ to: email, verifyUrl, expiresInHours: EXPIRY_HOURS });

  return { ok: true };
}

export async function consumeEmailVerificationToken(rawToken: string) {
  if (!rawToken || rawToken.length < 16) {
    return { ok: false, reason: 'invalid' as const };
  }
  const tokenHash = hashToken(rawToken);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!record) return { ok: false, reason: 'invalid' as const };
  if (record.usedAt) return { ok: false, reason: 'already_used' as const };
  if (record.expiresAt < new Date()) return { ok: false, reason: 'expired' as const };
  if (record.email !== record.user.email) return { ok: false, reason: 'email_changed' as const };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate any other unused tokens for this user
    prisma.emailVerificationToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true, userId: record.userId };
}
```

### Why `base64url` and not `hex`?
Shorter URL (~43 chars vs 64). Same entropy. URL-safe.

### Why only invalidate prior unused tokens on re-issue?
- Prevents user confusion if they click an old link after requesting a new one.
- Prevents "token farm" where attacker accumulates tokens.

---

## Email content

`services/templates/verifyEmail.tsx` (React Email):

```tsx
export function renderVerifyEmail({ to, verifyUrl, expiresInHours }: ...) {
  return {
    subject: 'Verify your email for Life Admin App',
    html: render(
      <Html>
        <Body style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
          <Container style={{ maxWidth: 560 }}>
            <Heading>Welcome 👋</Heading>
            <Text>Click the button below to verify your email. The link expires in {expiresInHours} hours.</Text>
            <Button href={verifyUrl} style={...}>Verify email</Button>
            <Text style={{ fontSize: 12, color: '#888' }}>
              Or copy and paste this URL: {verifyUrl}
            </Text>
            <Text style={{ fontSize: 12, color: '#888', marginTop: 24 }}>
              If you didn't sign up for Life Admin App, ignore this email.
            </Text>
          </Container>
        </Body>
      </Html>
    ),
    text: `Welcome! Verify your email: ${verifyUrl}\nLink expires in ${expiresInHours} hours.`,
  };
}
```

---

## UX & frontend flows

### Sign-up
1. User submits form.
2. API creates account, issues token, sends email, returns 201 + auth cookie.
3. Frontend lands user on `/dashboard` with a yellow banner:
   > "📧 We sent a verification link to **anna@example.com**. [Resend] [Change email]"

### Inbox → click link
1. Email client opens `https://api.lifeadmin.dev/api/auth/verify-email?token=...`.
2. API validates → redirects to `https://app.lifeadmin.dev/verify-email/success` (or
   `/verify-email/error?reason=expired`).
3. Frontend success page:
   > "✅ Email verified. You're all set."
4. If user is logged in (same browser as sign-up), they refresh → banner gone.
5. If different browser, success page has "Continue to app" → `/login`.

### Resend
- Button on the banner. Click → `POST /api/auth/resend-verification` → toast: "Sent — check
  your inbox."
- Disabled for 60 seconds after click (frontend rate-limit guard).
- If user is rate-limited server-side, response is still 200 (anti-enumeration). UX is
  identical.

### Error states
| `reason` | Page copy |
|----------|-----------|
| `invalid` | "This link is invalid. [Resend verification]" |
| `expired` | "This link has expired. [Resend verification]" |
| `already_used` | "This email is already verified. [Log in]" |
| `email_changed` | "This link is no longer valid because your email changed. [Resend verification]" |

---

## Security analysis

### Threats considered

| Threat | Mitigation |
|--------|------------|
| Token guessing | 256 bits of entropy → infeasible. |
| DB leak exposing tokens | Only SHA-256 hash stored. Tokens unusable from leaked DB. |
| Replay (using a used token) | `usedAt` set. 410 on reuse. |
| Stale token after email change | `email` snapshot mismatch → invalid. |
| Open redirect via `?next=` param | We don't accept arbitrary redirects. Always go to fixed `CLIENT_URL`. |
| Email enumeration via resend endpoint | Always-200, rate limited per email AND per IP. |
| Email enumeration via verify endpoint | Even invalid tokens redirect to a generic error page; no "user exists" leak. |
| Spam (mass resend triggered by attacker) | Rate limit: 1 / minute / email, 5 / hour / email, 20 / hour / IP. |
| Token tampering | Tokens are random; tampering yields invalid hash → 410. |
| HTTPS strip → MITM steals token | LIF-41 enforces HTTPS + HSTS. |
| Phishing email "verify your account" | Sender uses verified `lifeadmin.dev` (DKIM/SPF/DMARC). User-side guidance in email footer. |
| Prematurely-issued cookie + unverified email = bypass | Soft-gate is by design. Reminder emails (and any future feature) check `emailVerified`. |

### What we explicitly do NOT do
- We don't sign tokens with JWT (no need; opaque + DB lookup is simpler and revocable).
- We don't accept email in the verify URL — only the token. (`/verify?email=...&token=...`
  invites tampering and adds nothing.)

---

## Rate limiting

Configure in `routes/auth.ts`:

```ts
const resendVerifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1,
  keyGenerator: (req) => `${req.ip}:${(req.body?.email ?? '').toLowerCase()}`,
  standardHeaders: true,
  // IMPORTANT: don't return 429 → still always-200 to avoid enumeration.
  // Solution: use a custom handler that returns 200 with the same generic message.
  handler: (req, res) => res.status(200).json({ message: 'If that email is registered and unverified, we sent a link.' }),
});

const resendVerifyHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}:${(req.body?.email ?? '').toLowerCase()}`,
  handler: (req, res) => res.status(200).json({ message: 'If that email is registered and unverified, we sent a link.' }),
});

router.post('/resend-verification',
  resendVerifyLimiter, resendVerifyHourlyLimiter,
  body('email').isEmail().normalizeEmail(),
  resendVerification
);
```

---

## Cleanup job (optional, low priority)

Old tokens accumulate. Add to the cron job set:
```ts
cron.schedule('0 3 * * *', async () => {
  await prisma.emailVerificationToken.deleteMany({
    where: { OR: [
      { expiresAt: { lt: new Date() } },
      { usedAt: { lt: new Date(Date.now() - 30 * 86400000) } }, // used > 30 days ago
    ] },
  });
});
```

Not blocking for MVP; can be added in PR-3 of LIF-41 with the other ops items.

---

## Testing strategy

### Unit tests
1. `issueEmailVerificationToken` creates a row with hashed token; raw token is unguessable.
2. `consumeEmailVerificationToken`:
   - Valid token → user verified, token marked used.
   - Invalid token → returns `invalid`.
   - Expired token → returns `expired`.
   - Used token → returns `already_used`.
   - Email-changed scenario → returns `email_changed`.
3. Re-issuing token invalidates prior unused tokens.

### Integration tests
1. `POST /register` → `GET /verify-email?token=...` (extracted from email mock) → user
   verified.
2. `GET /verify-email?token=garbage` → 302 to error page.
3. `POST /resend-verification` for non-existent email → 200 (no leak), no email sent.
4. `POST /resend-verification` 6 times in an hour → 200 each (no 429), but only the first
   actually sends an email.

### Manual test
1. Sign up with a real email.
2. Check inbox, click link.
3. Verify banner disappears.
4. Try clicking the same link again → "already verified" page.
5. Sign up second account, request resend twice rapidly → only one email arrives.

---

## Migration of existing users

Existing users (Anna and any beta) will have `emailVerified=false` after migration.

Options:
1. **Grandfather them**: set a one-time migration to mark all pre-existing users
   `emailVerified=true`. (Not strictly safe but pragmatic for known-good MVP users.)
2. **Force re-verification**: leave them at `false`, send verification email on first
   login.

> **🚩 Decision needed #3 (Anna):** Grandfather existing users? Recommendation:
> **grandfather**, since you're the only real user and you trust your own email. New
> sign-ups go through the full flow.

If we grandfather, Engineer adds a one-shot migration script:
```sql
UPDATE "User" SET "emailVerified" = true, "emailVerifiedAt" = NOW()
WHERE "createdAt" < '2026-05-09';  -- migration day
```

---

## Frontend changes

New pages:
- `/verify-email/success` — success copy + "Continue" link.
- `/verify-email/error?reason=expired|invalid|already_used|email_changed` — appropriate
  error + resend button.

New component:
- `<UnverifiedEmailBanner />` — top of dashboard when `me.emailVerified === false`.

New API client methods:
- `resendVerification(email)`.

Tracked as separate frontend ticket; Engineer ships server endpoints + pages can be hand-stubbed
HTML for MVP.

---

## Environment variables (new)

```
API_URL=https://api.lifeadmin.dev      # used to build verifyUrl
CLIENT_URL=https://app.lifeadmin.dev   # already exists; used for redirects after verify
EMAIL_FROM=reminders@lifeadmin.dev     # already exists from LIF-42
```

---

## Rollout plan

1. Schema migration + Prisma client regen.
2. Service code (`emailVerificationService.ts`).
3. Update register controller to issue token.
4. Add `verify-email` and `resend-verification` routes.
5. Add `emailVerified` to `/api/auth/me` response.
6. Frontend: stub success/error pages, banner.
7. Run grandfather migration (if Anna approves).
8. Deploy. Monitor first verification through logs.

If something breaks: roll back. Existing users still log in; they just don't have working
verification (which is current state anyway).

---

## Open decisions for Anna

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Soft-gate (login allowed, features degraded) vs hard-gate (must verify to log in)? | Soft-gate. |
| 2 | Should the verify link auto-log-the-user-in? | No. Email proves ownership of inbox, not knowledge of password. |
| 3 | Grandfather existing users to verified=true? | Yes (you're effectively the only one). |
| 4 | Block reminder emails for unverified users? (already specified in LIF-42) | Yes. |
| 5 | Token expiry — 24h good? | Yes. Standard. |

---

## Handoff to Engineer

Implementation order (best fit alongside LIF-42, since both share `emailService.ts`):
1. Schema migration (`add_email_verification`).
2. `emailVerificationService.ts` + tests.
3. `verifyEmail.tsx` template.
4. Register controller hook.
5. `GET /verify-email` route + redirect logic.
6. `POST /resend-verification` route with always-200 handler + rate limits.
7. `/api/auth/me` adds `emailVerified` field.
8. Cleanup cron entry (optional, can defer).
9. Grandfather migration script (if Anna approves Decision #3).
10. README updates.

Estimate: **1 day** if LIF-42 already shipped (reuse Resend wrapper); **1.5 days** if
shipping in parallel.

Dependencies:
- Builds on the email infrastructure from LIF-42 — recommend shipping LIF-42 first or
  alongside.
- Cookies/CSRF from LIF-41 PR-1 should land first so the verify endpoint isn't a CSRF
  problem (it's a GET, but resend is POST).
