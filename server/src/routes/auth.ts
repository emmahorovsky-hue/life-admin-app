import express from 'express';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  logout,
  getMe,
  verifyEmail,
  resendVerification,
} from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

if (process.env.DISABLE_AUTH_RATE_LIMIT === 'true') {
  console.warn(
    '[auth] WARNING: DISABLE_AUTH_RATE_LIMIT is set — all auth rate limiting is disabled. ' +
    'Do NOT use this in production or staging environments.'
  );
}

const isTestEnv = process.env.NODE_ENV === 'test' || process.env.DISABLE_AUTH_RATE_LIMIT === 'true';

// Rate limiter for auth endpoints (5 requests per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skip: () => isTestEnv,
  message: {
    error: {
      message: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiters for resend-verification (anti-enumeration: always return 200)
const genericResponse = {
  message: "If that email is registered and unverified, we've sent a verification link.",
};

const resendPerEmailLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1,
  skip: () => isTestEnv,
  keyGenerator: (req) => req.body.email?.toLowerCase() || req.ip,
  handler: (req, res) => res.status(200).json(genericResponse),
  standardHeaders: false,
  legacyHeaders: false,
});

const resendPerEmailHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  skip: () => isTestEnv,
  keyGenerator: (req) => req.body.email?.toLowerCase() || req.ip,
  handler: (req, res) => res.status(200).json(genericResponse),
  standardHeaders: false,
  legacyHeaders: false,
});

const resendPerIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  skip: () => isTestEnv,
  handler: (req, res) => res.status(200).json(genericResponse),
  standardHeaders: false,
  legacyHeaders: false,
});

// POST /api/auth/register
router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
    body('password')
      .isStrongPassword({
        minLength: 8,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
      })
      .withMessage('Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character'),
    body('name').optional().trim(),
  ],
  register
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
    // Login intentionally uses .notEmpty() rather than isStrongPassword() so that
    // users who registered before the strong-password policy was introduced can
    // still log in. Strength enforcement only applies at registration time.
    body('password').notEmpty().withMessage('Password is required'),
  ],
  login
);

// POST /api/auth/logout
router.post('/logout', logout);

// GET /api/auth/me
router.get('/me', authenticateToken, getMe);

// GET /api/auth/verify-email
router.get('/verify-email', verifyEmail);

// POST /api/auth/resend-verification
router.post(
  '/resend-verification',
  resendPerEmailLimiter,
  resendPerEmailHourlyLimiter,
  resendPerIpLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  ],
  resendVerification
);

export default router;
