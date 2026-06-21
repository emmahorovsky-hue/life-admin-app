import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Pre-auth routes are exempt from CSRF validation: the user has no session yet,
// so there is no ambient authority for an attacker to ride. Exempting them also
// avoids a chicken-and-egg deadlock — a fresh browser has no csrf_token cookie,
// so its very first POST (e.g. login) would otherwise always 403.
const EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/verify-email',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/resend-verification',
]);

export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Disabled under test so the existing supertest suites need no CSRF headers.
  // Read at call-time (not module-load) so the dedicated CSRF tests can exercise
  // the middleware by overriding NODE_ENV. See csrf.test.ts.
  if (process.env.NODE_ENV === 'test') return next();

  const isProduction = process.env.NODE_ENV === 'production';

  // Ensure a CSRF token exists. The cookie is intentionally NOT httpOnly, but
  // cross-origin SPAs (Vercel frontend → Railway API) can't read it via
  // document.cookie, so we also surface it as a readable response header that
  // the client captures and echoes back. The cookie travels automatically with
  // every request (double-submit); the header proves the caller could read it.
  let token: string = req.cookies[CSRF_COOKIE];
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    });
    req.cookies[CSRF_COOKIE] = token;
  }
  res.setHeader(CSRF_HEADER, token);

  if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  const cookieToken: string = req.cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  let valid = false;
  if (typeof headerToken === 'string') {
    const cookieBuf = Buffer.from(cookieToken);
    const headerBuf = Buffer.from(headerToken);
    // Compare *byte* lengths — timingSafeEqual throws on unequal-length buffers,
    // and a non-ASCII header could match in string length but differ in bytes.
    valid =
      cookieBuf.length === headerBuf.length &&
      crypto.timingSafeEqual(cookieBuf, headerBuf);
  }

  if (!valid) {
    res.status(403).json({
      error: {
        message: 'Invalid or missing CSRF token.',
        code: 'CSRF_VALIDATION_FAILED',
      },
    });
    return;
  }

  next();
}
