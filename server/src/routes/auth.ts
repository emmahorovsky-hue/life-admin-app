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
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword,
  initiateEmailChangeHandler,
  verifyEmailChange,
  registerDeviceTokenHandler,
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

// Per-endpoint rate limiters. Each rateLimit() call owns its own counter
// store, so every endpoint gets an independent budget — a single shared
// instance would pool unrelated endpoints into one 5-requests/15-min bucket,
// letting a normal login → device-token → change-password flow rate-limit
// itself, and making users behind shared NAT collide with each other.
const createAuthLimiter = (max: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max,
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

const registerLimiter = createAuthLimiter(5);
const loginLimiter = createAuthLimiter(5);
const resetPasswordLimiter = createAuthLimiter(5);
const changePasswordLimiter = createAuthLimiter(5);
const changeEmailLimiter = createAuthLimiter(5);
// Registered on every app launch/login (authenticated, idempotent upsert), and
// NAT peers share the IP bucket — needs more headroom than credential endpoints.
const deviceTokenLimiter = createAuthLimiter(30);

// Rate limiters for resend-verification (anti-enumeration: always return 200)
const genericResponse = {
  message: "If that email is registered and unverified, we've sent a verification link.",
};

// Rate limiters for forgot-password (anti-enumeration: always return 200)
const forgotPasswordGenericResponse = {
  message: "If that email is registered, we've sent a password reset link.",
};

const forgotPasswordPerEmailLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1,
  skip: () => isTestEnv,
  keyGenerator: (req) => req.body.email?.toLowerCase() || req.ip,
  handler: (req, res) => res.status(200).json(forgotPasswordGenericResponse),
  standardHeaders: false,
  legacyHeaders: false,
});

const forgotPasswordPerEmailHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  skip: () => isTestEnv,
  keyGenerator: (req) => req.body.email?.toLowerCase() || req.ip,
  handler: (req, res) => res.status(200).json(forgotPasswordGenericResponse),
  standardHeaders: false,
  legacyHeaders: false,
});

const forgotPasswordPerIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  skip: () => isTestEnv,
  handler: (req, res) => res.status(200).json(forgotPasswordGenericResponse),
  standardHeaders: false,
  legacyHeaders: false,
});

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
  registerLimiter,
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
  loginLimiter,
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

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  forgotPasswordPerEmailLimiter,
  forgotPasswordPerEmailHourlyLimiter,
  forgotPasswordPerIpLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  ],
  forgotPassword
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  resetPasswordLimiter,
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password')
      .isStrongPassword({
        minLength: 8,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
      })
      .withMessage('Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character'),
  ],
  resetPassword
);

// PATCH /api/auth/profile
router.patch(
  '/profile',
  authenticateToken,
  [
    body('name').optional().trim(),
    body('surname').optional().trim(),
  ],
  updateProfile
);

// POST /api/auth/device-token
router.post(
  '/device-token',
  authenticateToken,
  deviceTokenLimiter,
  [
    body('token').isString().trim().notEmpty().withMessage('Token is required'),
    body('platform').isString().isIn(['ios', 'android']).withMessage('Platform must be "ios" or "android"'),
  ],
  registerDeviceTokenHandler
);

// POST /api/auth/change-password
router.post(
  '/change-password',
  authenticateToken,
  changePasswordLimiter,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isStrongPassword({
        minLength: 8,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
      })
      .withMessage('Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character'),
  ],
  changePassword
);

// POST /api/auth/change-email
router.post(
  '/change-email',
  authenticateToken,
  changeEmailLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  ],
  initiateEmailChangeHandler
);

// GET /api/auth/verify-email-change
router.get('/verify-email-change', verifyEmailChange);

export default router;
