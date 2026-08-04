import axios from 'axios';

// Server errors follow ErrorResponse ({ error: { message } }) — surface that
// message when present, otherwise the caller's fallback.
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.error?.message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}

// A 429 with no usable Retry-After still deserves a pause. Long enough that a
// tap-happy user cannot re-trip the limiter, short enough to feel like a wait
// rather than a lockout.
const FALLBACK_RETRY_AFTER_MS = 30_000;

/**
 * How long to wait before retrying a rejected request, or null if it was not a
 * rate-limit rejection.
 *
 * Every limiter on the API sends `Retry-After` (express-rate-limit, with
 * `standardHeaders: true`), so the exact figure is available rather than
 * guessed — which matters, because the general limiter's window is 15 minutes
 * and an immediate retry cannot possibly succeed.
 */
export function getRetryAfterMs(err: unknown): number | null {
  if (!axios.isAxiosError(err) || err.response?.status !== 429) return null;

  const header = err.response.headers?.['retry-after'];
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;

  return FALLBACK_RETRY_AFTER_MS;
}

/**
 * "in 30 seconds" / "in 3 minutes" — a wait a person can act on. Rounds up, so
 * the advice is never early enough to fail again.
 */
export function formatRetryDelay(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `in ${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}
