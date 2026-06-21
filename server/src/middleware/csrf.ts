import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const isProduction = process.env.NODE_ENV === 'production';

const isTestEnv = process.env.NODE_ENV === 'test';

export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isTestEnv) return next();
  // Ensure a CSRF token cookie exists so the frontend can read it before its
  // first mutating request. The cookie is intentionally NOT httpOnly — the
  // client must be able to read it via document.cookie.
  if (!req.cookies[CSRF_COOKIE]) {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    });
    req.cookies[CSRF_COOKIE] = token;
  }

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const cookieToken: string = req.cookies[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  const valid =
    typeof headerToken === 'string' &&
    cookieToken.length === headerToken.length &&
    crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));

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
