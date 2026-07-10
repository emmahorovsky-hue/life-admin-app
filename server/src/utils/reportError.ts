import * as Sentry from '@sentry/node';

// Controllers respond to failures directly from their catch blocks, so errors
// never propagate to the Express error middleware or to Sentry's
// setupExpressErrorHandler. Route catch-block logging through this helper so
// server errors are still reported to Sentry (no-op when SENTRY_DSN is unset,
// e.g. in tests and local dev).
export function reportServerError(context: string, error: unknown): void {
  console.error(`${context}:`, error);
  Sentry.captureException(error, { tags: { context } });
}
