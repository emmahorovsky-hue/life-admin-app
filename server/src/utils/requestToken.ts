import type { Request } from 'express';

/**
 * The auth token carried by a request, or null if it has none.
 *
 * Both transports are first-class (see CLAUDE.md "Auth flow"): web sends the
 * httpOnly `token` cookie, mobile sends `Authorization: Bearer`. The header wins
 * so a Bearer client is never overridden by a stale cookie.
 *
 * Shared by `authenticateToken` and the general rate limiter's key generator so
 * the two can't drift apart — if a third transport is ever added, both pick it
 * up at once.
 */
export const getRequestToken = (req: Request): string | null => {
  const authHeader = req.headers['authorization'];
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  // req.cookies is undefined wherever cookie-parser hasn't run (unit tests that
  // mount a bare router), so this must stay optional-chained.
  return bearer ?? (req.cookies?.token as string | undefined) ?? null;
};
