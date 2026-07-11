// Loads server/.env as an import side effect. This module is the first import
// of index.ts, which is what guarantees every other module's module-scope
// process.env reads (cron schedules, rate-limit flags, RESEND_API_KEY, …) see
// .env values — keep it first here and first in index.ts.
import 'dotenv/config';

import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    // Never attach request bodies, cookies, or user IP to events. The app uses
    // httpOnly auth cookies and handles user emails, so keep PII off by default.
    sendDefaultPii: false,
  });
}
