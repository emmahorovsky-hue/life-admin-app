import rateLimit from 'express-rate-limit';

// General API rate limit (LIF-24). Auth endpoints keep their own much tighter
// per-endpoint limiters in routes/auth.ts, and /subscriptions/extract keeps its
// per-user LLM-cost throttle — this is a coarse per-IP backstop for everything
// else (subscriptions CRUD, dashboard, categories). The ceiling is deliberately
// generous: traffic is authenticated SPA usage and NAT peers share an IP bucket.
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

export interface ApiLimiterOptions {
  windowMs?: number;
  max?: number;
  /** Force the limiter on/off regardless of environment (used by tests). */
  enabled?: boolean;
}

export const createApiLimiter = ({
  windowMs = Number(process.env.API_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  max = Number(process.env.API_RATE_LIMIT_MAX ?? 300),
  enabled = !isTestEnv && !disableRateLimit,
}: ApiLimiterOptions = {}) =>
  rateLimit({
    windowMs,
    max,
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
