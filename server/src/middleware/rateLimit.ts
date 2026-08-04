import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { verifyToken } from '../utils/jwt';
import { getRequestToken } from '../utils/requestToken';
import { logSecurityEvent } from '../utils/securityLog';
import type { AuthRequest } from './auth';

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
 * Keys are namespaced so a user id can never collide with an IP literal, and
 * scoped by route group so the two halves of the API cannot starve each other
 * (see `bucketScope`).
 */
const apiRateLimitKey = (req: Request): string => {
  const scope = bucketScope(req);
  const token = getRequestToken(req);

  if (token) {
    try {
      const { userId } = verifyToken(token);
      if (userId) return `user:${userId}:${scope}`;
    } catch {
      // Fall through to the IP bucket.
    }
  }

  // ipKeyGenerator normalises IPv6 to a /56 subnet; keying on a bare IPv6
  // address would let one client cycle through addresses within its own prefix.
  return `ip:${ipKeyGenerator(req.ip ?? '')}:${scope}`;
};

/**
 * Which half of the API a request belongs to: `auth` for /api/auth/*, `app` for
 * everything else (subscriptions, dashboard, account).
 *
 * One shared bucket per user made a single misbehaving endpoint able to lock a
 * user out of the entire product. That is not hypothetical: a mobile build
 * looped on POST /api/auth/device-token at up to 400 requests/second, and
 * because this limiter is mounted on all of /api *before* the routers, every
 * one of those attempts — including the ones the tighter per-endpoint auth
 * limiter rejected microseconds later — spent a token from the same budget the
 * user's subscription screens draw on. They saw "Too many requests" while
 * saving two rows.
 *
 * Splitting the budget does not make the ceiling looser for either half; it
 * means a runaway auth client can only cost the user their auth calls, never
 * their data. The scope is derived from `originalUrl` because this middleware
 * is mounted at /api, which strips the prefix from `req.path`.
 */
const bucketScope = (req: Request): 'auth' | 'app' => {
  const path = req.originalUrl.split('?')[0];
  return path === '/api/auth' || path.startsWith('/api/auth/') ? 'auth' : 'app';
};

/**
 * Bucket key for a limiter that runs *after* `authenticateToken`, so it can
 * read the verified user off the request rather than re-verifying the token.
 * Same namespacing as above, minus the route scope — per-endpoint limiters own
 * their store, so there is nothing to collide with.
 */
export const authenticatedUserKey = (req: Request): string => {
  const userId = (req as AuthRequest).user?.userId;
  if (userId) return `user:${userId}`;
  return `ip:${ipKeyGenerator(req.ip ?? '')}`;
};

export interface ApiLimiterOptions {
  windowMs?: number;
  max?: number;
  /** Force the limiter on/off regardless of environment (used by tests). */
  enabled?: boolean;
}

/**
 * One report per bucket per minute, rather than one per rejected request.
 *
 * A tripped limiter does not reject once, it rejects everything the client
 * sends for the rest of the window — the incident that motivated this logging
 * was ~5,000 rejections in 13 minutes. Logging each one buries the signal and
 * (via Sentry) bills for the privilege. The first rejection is the news.
 */
const REPORT_INTERVAL_MS = 60_000;
const lastReportedAt = new Map<string, number>();

const shouldReport = (key: string, now: number): boolean => {
  const previous = lastReportedAt.get(key);
  if (previous !== undefined && now - previous < REPORT_INTERVAL_MS) return false;

  lastReportedAt.set(key, now);
  // Keep the map from growing without bound under a distributed burst: once it
  // is large, drop the entries whose interval has already lapsed.
  if (lastReportedAt.size > 1000) {
    for (const [candidate, at] of lastReportedAt) {
      if (now - at >= REPORT_INTERVAL_MS) lastReportedAt.delete(candidate);
    }
  }
  return true;
};

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
    // A handler rather than `message`, so a trip leaves a trace. This limiter
    // used to reject silently: no log line, no Sentry (the error handler in
    // index.ts only captures 5xx), nothing but a 429 the client had to explain
    // to the user. The response body is unchanged — mobile surfaces it verbatim
    // (mobile/lib/utils.ts) and both clients match on `code`.
    handler: (req, res) => {
      const key = apiRateLimitKey(req);
      if (shouldReport(key, Date.now())) {
        const [namespace, id] = key.split(':');
        logSecurityEvent('api.rate_limit.exceeded', req, {
          // Query strings can carry tokens — path only, per securityLog's contract.
          route: req.originalUrl.split('?')[0],
          reason: namespace === 'user' ? 'user_bucket' : 'ip_bucket',
          ...(namespace === 'user' && { userId: id }),
        });
      }
      res.status(429).json({
        error: {
          message: 'Too many requests, please try again later',
          code: 'RATE_LIMIT_EXCEEDED',
        },
      });
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

export const apiLimiter = createApiLimiter();
