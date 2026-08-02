import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { verifyToken } from '../utils/jwt';
import { getRequestToken } from '../utils/requestToken';

// General API rate limit (LIF-24). Auth endpoints keep their own much tighter
// per-endpoint limiters in routes/auth.ts, and /subscriptions/extract keeps its
// per-user LLM-cost throttle — this is a coarse backstop for everything else
// (subscriptions CRUD, dashboard, categories).
const isTestEnv = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';

// DISABLE_RATE_LIMIT is a dev/load-testing escape hatch only. In production it
// is ignored rather than honored, so a leaked env var can't silently strip the
// API's rate limiting (mirrors DISABLE_AUTH_RATE_LIMIT in routes/auth.ts).
const disableRateLimit = process.env.DISABLE_RATE_LIMIT === 'true' && !isProduction;

if (process.env.DISABLE_RATE_LIMIT === 'true') {
  if (isProduction) {
    console.warn(
      '[rate-limit] WARNING: DISABLE_RATE_LIMIT is set but NODE_ENV is production — ' +
      'ignoring it; the general API rate limit stays enabled.'
    );
  } else {
    console.warn(
      '[rate-limit] WARNING: DISABLE_RATE_LIMIT is set — the general API rate limit is disabled. ' +
      'Do NOT use this in production or staging environments.'
    );
  }
}

/**
 * Bucket key for a request: the authenticated user when there is one, their IP
 * otherwise.
 *
 * Keying on the user rather than the IP is what makes this limiter correct
 * behind a proxy chain (LIF-240). Production web traffic arrives via a Vercel
 * rewrite (client/vercel.json), so every browser request reaches us from one of
 * a handful of Vercel egress IPs — an IP-keyed bucket lumped the entire web user
 * base together and handed out spurious 429s on ordinary screens. A user-keyed
 * bucket is immune to that, and to corporate/carrier NAT besides.
 *
 * This runs before `authenticateToken` (the limiter is mounted on all of /api,
 * auth is applied per-route), so `req.user` isn't populated yet and the token
 * has to be verified here. Verification is a local HMAC check — no DB round
 * trip. A token that is expired, forged, or revoked simply falls back to the IP
 * bucket: this is a traffic ceiling, not an authorization decision, and the real
 * auth middleware still rejects the request downstream.
 *
 * Keys are namespaced so a user id can never collide with an IP literal.
 */
const apiRateLimitKey = (req: Request): string => {
  const token = getRequestToken(req);

  if (token) {
    try {
      const { userId } = verifyToken(token);
      if (userId) return `user:${userId}`;
    } catch {
      // Fall through to the IP bucket.
    }
  }

  // ipKeyGenerator normalises IPv6 to a /56 subnet; keying on a bare IPv6
  // address would let one client cycle through addresses within its own prefix.
  return `ip:${ipKeyGenerator(req.ip ?? '')}`;
};

export interface ApiLimiterOptions {
  windowMs?: number;
  max?: number;
  /** Force the limiter on/off regardless of environment (used by tests). */
  enabled?: boolean;
}

export const createApiLimiter = ({
  windowMs = Number(process.env.API_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  // Per user, not per IP — a single account doing normal SPA work stays far
  // under this, while a runaway client loop still gets stopped.
  max = Number(process.env.API_RATE_LIMIT_MAX ?? 1000),
  enabled = !isTestEnv && !disableRateLimit,
}: ApiLimiterOptions = {}) =>
  rateLimit({
    windowMs,
    max,
    keyGenerator: apiRateLimitKey,
    skip: () => !enabled,
    message: {
      error: {
        message: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

export const apiLimiter = createApiLimiter();
