import { Request } from 'express';
import * as Sentry from '@sentry/node';

// Structured security-event logging for the auth surface (LIF-30).
//
// Every event is emitted as a single JSON line on stdout (Railway captures
// stdout, so these are searchable in the deploy logs without any extra
// logging framework), and mirrored to Sentry as a breadcrumb so security
// context is attached to any subsequent error event. High-signal events
// (see HIGH_SIGNAL below) are additionally captured as Sentry messages so
// they can be alerted on even when no exception occurs.
//
// Rules:
// - NEVER pass passwords, tokens, or other secret material in `details`.
//   Log token *events* (issued/consumed/rejected + reason), not token values.
//   The SecurityEventDetails type is intentionally narrow to enforce this.
// - Sentry is configured with sendDefaultPii: false (see instrument.ts), so
//   emails and IPs are deliberately kept OUT of everything sent to Sentry.
//   They only appear in the first-party stdout log line.

export type SecurityEventType =
  | 'auth.login.success'
  | 'auth.login.failure'
  | 'auth.logout'
  | 'auth.register.success'
  | 'auth.password_reset.requested'
  | 'auth.password_reset.completed'
  | 'auth.password_reset.failed'
  | 'auth.password.changed'
  | 'auth.password.change_failed'
  | 'auth.email_verification.success'
  | 'auth.email_verification.failure'
  | 'auth.email_change.requested'
  | 'auth.email_change.completed'
  | 'auth.email_change.failed'
  | 'auth.rate_limit.exceeded'
  | 'account.deleted'
  | 'account.delete_failed';

export interface SecurityEventDetails {
  userId?: string;
  email?: string;
  /** Machine-readable cause (e.g. 'invalid_password', 'expired') — never secret material. */
  reason?: string;
  /** Route the event fired on (path only — never include query strings, they can carry tokens). */
  route?: string;
}

// Events worth an actual Sentry message (alertable), not just a breadcrumb.
// Successful logins/registrations are routine; repeated failures and
// rate-limit trips are the attack signals this ticket is about.
const HIGH_SIGNAL: ReadonlySet<SecurityEventType> = new Set([
  'auth.rate_limit.exceeded',
]);

const FAILURE_EVENTS: ReadonlySet<SecurityEventType> = new Set([
  'auth.login.failure',
  'auth.password_reset.failed',
  'auth.password.change_failed',
  'auth.email_verification.failure',
  'auth.email_change.failed',
  'auth.rate_limit.exceeded',
  'account.delete_failed',
]);

export function logSecurityEvent(
  event: SecurityEventType,
  req: Request,
  details: SecurityEventDetails = {}
): void {
  const { userId, email, reason, route } = details;

  const entry = {
    type: 'security_event',
    event,
    timestamp: new Date().toISOString(),
    // `trust proxy` is set in index.ts, so req.ip is the real client IP
    // behind Railway's proxy.
    ip: req.ip,
    userAgent: req.get('user-agent'),
    ...(userId !== undefined && { userId }),
    ...(email !== undefined && { email }),
    ...(reason !== undefined && { reason }),
    ...(route !== undefined && { route }),
  };

  // Single-line JSON so log aggregators can parse it.
  console.log(JSON.stringify(entry));

  if (!Sentry.isInitialized()) return;

  const level: Sentry.SeverityLevel = FAILURE_EVENTS.has(event) ? 'warning' : 'info';

  // No email/IP here — sendDefaultPii is false by design (instrument.ts).
  Sentry.addBreadcrumb({
    category: 'security',
    message: event,
    level,
    data: {
      ...(userId !== undefined && { userId }),
      ...(reason !== undefined && { reason }),
      ...(route !== undefined && { route }),
    },
  });

  if (HIGH_SIGNAL.has(event)) {
    Sentry.captureMessage(`Security event: ${event}`, {
      level,
      tags: { securityEvent: event, ...(route !== undefined && { route }) },
      extra: {
        ...(userId !== undefined && { userId }),
        ...(reason !== undefined && { reason }),
      },
    });
  }
}
