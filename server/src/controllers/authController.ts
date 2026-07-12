import { Response } from 'express';
import { validationResult } from 'express-validator';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/db';
import { generateToken, passwordChangedAtNow, sessionsValidFromNow, verifyToken } from '../utils/jwt';
import { issueEmailVerificationToken, consumeEmailVerificationToken } from '../services/emailVerificationService';
import { issuePasswordResetToken, consumePasswordResetToken } from '../services/passwordResetService';
import { initiateEmailChange, consumeEmailChangeToken } from '../services/emailChangeService';
import { registerDeviceToken } from '../services/deviceTokenService';
import { reportServerError } from '../utils/reportError';
import { logSecurityEvent } from '../utils/securityLog';

// The frontend (Vercel) and backend (Railway) are served from different sites
// in production, so the auth cookie must be SameSite=None to be sent on the
// cross-site fetch from the SPA. None requires Secure. In local dev everything
// is same-site on localhost, where Lax works and Secure can't be guaranteed
// over plain HTTP, so we fall back to lax/insecure there.
const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ('none' as const) : ('lax' as const),
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
        },
      });
      return;
    }

    const { email, password, name } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({
        error: {
          message: 'Email already registered',
          code: 'EMAIL_EXISTS',
        },
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      // Keep this select in sync with login/getMe so all auth paths return the
      // full shared `User` shape (LIF-132).
      select: {
        id: true,
        email: true,
        name: true,
        surname: true,
        emailVerified: true,
        emailVerifiedAt: true,
        reminderEmailsEnabled: true,
        reminderPushEnabled: true,
        timezone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Issue email verification token and send email. Await token creation
    // so tests and cleanup won't race with a background task. Sending the
    // actual email is handled inside the service and can fail independently.
    const platform = req.headers['x-platform'] as string | undefined;
    try {
      await issueEmailVerificationToken(user.id, user.email, platform);
    } catch (err) {
      reportServerError('Failed to send verification email', err);
    }

    logSecurityEvent('auth.register.success', req, { userId: user.id, email: user.email });

    // Generate JWT
    const token = generateToken({ userId: user.id, email: user.email });

    // Set cookie
    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user,
    });
  } catch (error) {
    // Concurrent registrations with the same email can both pass the existence
    // check above; the loser's `create` then hits the unique constraint on
    // email (P2002). Map it to the same 400 the check produces (LIF-145).
    // The only other Prisma write in this handler (verification token) has its
    // own try/catch, so a P2002 here can only come from the user create.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(400).json({
        error: {
          message: 'Email already registered',
          code: 'EMAIL_EXISTS',
        },
      });
      return;
    }
    reportServerError('Register error', error);
    res.status(500).json({
      error: {
        message: 'Failed to register user',
        code: 'REGISTER_FAILED',
      },
    });
  }
};

export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
        },
      });
      return;
    }

    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      logSecurityEvent('auth.login.failure', req, { email, reason: 'unknown_email' });
      res.status(401).json({
        error: {
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        },
      });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      logSecurityEvent('auth.login.failure', req, {
        userId: user.id,
        email: user.email,
        reason: 'invalid_password',
      });
      res.status(401).json({
        error: {
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        },
      });
      return;
    }

    logSecurityEvent('auth.login.success', req, { userId: user.id, email: user.email });

    // Generate JWT
    const token = generateToken({ userId: user.id, email: user.email });

    // Set cookie
    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        reminderEmailsEnabled: user.reminderEmailsEnabled,
        reminderPushEnabled: user.reminderPushEnabled,
        timezone: user.timezone,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    reportServerError('Login error', error);
    res.status(500).json({
      error: {
        message: 'Failed to login',
        code: 'LOGIN_FAILED',
      },
    });
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  // Clearing the cookie only drops the client's copy — the JWT is stateless and
  // stays valid until it expires. Stamping sessionsValidFrom is what actually
  // revokes it: the auth middleware rejects any token whose iat predates it
  // (LIF-174). This is a whole-account revocation, so logging out on one device
  // ends every session — deliberate for a single-user personal app.
  //
  // The route is intentionally unauthenticated, so we resolve the user from the
  // token by hand rather than trusting req.user. Revocation is best-effort: a
  // missing, malformed or already-expired token has nothing left to revoke, and
  // logout must stay idempotent and always return 200. Clients await this call
  // before clearing local state, so a 401 here would strand them logged in.
  const authHeader = req.headers['authorization'];
  const rawToken =
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) ?? req.cookies?.token;

  // An absent, malformed or already-expired token is the normal case, not an
  // error: there is no live session left to revoke. Resolve it quietly.
  let userId: string | null = null;
  if (rawToken) {
    try {
      userId = verifyToken(rawToken).userId;
    } catch {
      userId = null;
    }
  }

  if (userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { sessionsValidFrom: sessionsValidFromNow() },
      });
      logSecurityEvent('auth.logout', req, { userId });
    } catch (error) {
      // P2025 = user already deleted; their tokens die with the row, so there is
      // nothing to revoke. Anything else is a real failure worth reporting — but
      // it must not fail the request, or the client is stranded logged in.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025')) {
        reportServerError('Logout revocation failed', error);
      }
    }
  }

  // clearCookie must use the same attributes the cookie was set with, or the
  // browser won't match and clear it (notably sameSite/secure cross-site).
  res.clearCookie('token', {
    httpOnly: COOKIE_OPTIONS.httpOnly,
    secure: COOKIE_OPTIONS.secure,
    sameSite: COOKIE_OPTIONS.sameSite,
  });
  res.status(200).json({
    message: 'Logout successful',
  });
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          message: 'Not authenticated',
          code: 'NOT_AUTHENTICATED',
        },
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        surname: true,
        emailVerified: true,
        emailVerifiedAt: true,
        reminderEmailsEnabled: true,
        reminderPushEnabled: true,
        timezone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        },
      });
      return;
    }

    res.status(200).json({ user });
  } catch (error) {
    reportServerError('GetMe error', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch user',
        code: 'FETCH_USER_FAILED',
      },
    });
  }
};

export const verifyEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  const isMobile = req.query.platform === 'mobile';
  // Normalize so redirects survive env vars configured with or without trailing slashes
  const webUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const mobileUrl = (process.env.MOBILE_URL || 'lifeadmin://').replace(/([^/])$/, '$1/');
  const url = (path: string) => isMobile ? `${mobileUrl}${path}` : `${webUrl}/${path}`;
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      logSecurityEvent('auth.email_verification.failure', req, { reason: 'missing_token' });
      res.redirect(url('verify-email/error?reason=invalid'));
      return;
    }

    const result = await consumeEmailVerificationToken(token);

    if (!result.ok) {
      logSecurityEvent('auth.email_verification.failure', req, { reason: result.reason });
      res.redirect(url(`verify-email/error?reason=${result.reason}`));
      return;
    }

    logSecurityEvent('auth.email_verification.success', req, { userId: result.userId });
    res.redirect(url('verify-email/success'));
  } catch (error) {
    reportServerError('Verify email error', error);
    res.redirect(url('verify-email/error?reason=invalid'));
  }
};

export const forgotPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  const genericResponse = { message: "If that email is registered, we've sent a password reset link." };
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(200).json(genericResponse);
      return;
    }

    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      // Response stays generic (anti-enumeration), but the attempt is still
      // worth a first-party log line — bursts of unknown-email requests are
      // an enumeration/abuse signal.
      logSecurityEvent('auth.password_reset.requested', req, { email, reason: 'unknown_email' });
      res.status(200).json(genericResponse);
      return;
    }

    logSecurityEvent('auth.password_reset.requested', req, { userId: user.id, email: user.email });

    const platform = req.headers['x-platform'] as string | undefined;
    issuePasswordResetToken(user.id, user.email, platform).catch((err) => {
      reportServerError('Failed to send password reset email', err);
    });

    res.status(200).json(genericResponse);
  } catch (error) {
    reportServerError('Forgot password error', error);
    res.status(200).json(genericResponse);
  }
};

export const resetPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: errors.array() },
      });
      return;
    }

    const { token, password } = req.body;
    const result = await consumePasswordResetToken(token);

    if (!result.ok) {
      logSecurityEvent('auth.password_reset.failed', req, { reason: result.reason });
      const messages: Record<string, string> = {
        invalid: 'This password reset link is invalid.',
        expired: 'This password reset link has expired. Please request a new one.',
        already_used: 'This password reset link has already been used.',
      };
      res.status(400).json({
        error: { message: messages[result.reason] ?? 'Invalid reset link.', code: 'INVALID_RESET_TOKEN' },
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: result.userId },
        // Floored to the second (see passwordChangedAtNow) so both password
        // paths store the same precision the middleware compares against iat.
        data: { password: hashedPassword, passwordChangedAt: passwordChangedAtNow() },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: result.userId, usedAt: null },
        data: { usedAt: now },
      }),
    ]);

    logSecurityEvent('auth.password_reset.completed', req, { userId: result.userId });

    res.status(200).json({ message: 'Password reset successfully.' });
  } catch (error) {
    reportServerError('Reset password error', error);
    res.status(500).json({
      error: { message: 'Failed to reset password', code: 'RESET_PASSWORD_FAILED' },
    });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: errors.array() },
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
      return;
    }

    const { name, surname, reminderEmailsEnabled, timezone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        name: name ?? undefined,
        surname: surname ?? undefined,
        reminderEmailsEnabled: reminderEmailsEnabled ?? undefined,
        timezone: timezone ?? undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        surname: true,
        emailVerified: true,
        emailVerifiedAt: true,
        reminderEmailsEnabled: true,
        reminderPushEnabled: true,
        timezone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({ user });
  } catch (error) {
    reportServerError('Update profile error', error);
    res.status(500).json({ error: { message: 'Failed to update profile', code: 'UPDATE_PROFILE_FAILED' } });
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: errors.array() },
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ error: { message: 'User not found', code: 'USER_NOT_FOUND' } });
      return;
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      logSecurityEvent('auth.password.change_failed', req, {
        userId: user.id,
        email: user.email,
        reason: 'invalid_current_password',
      });
      res.status(400).json({ error: { message: 'Current password is incorrect', code: 'INVALID_CURRENT_PASSWORD' } });
      return;
    }

    if (currentPassword === newPassword) {
      res.status(400).json({ error: { message: 'New password must be different from the current password', code: 'PASSWORD_UNCHANGED' } });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Floored to the second (see passwordChangedAtNow) so the re-issued token's
    // iat satisfies iat >= passwordChangedAt/1000, keeping this session alive
    // while still invalidating older sessions.
    const passwordChangedAt = passwordChangedAtNow();
    const token = generateToken({ userId: user.id, email: user.email });

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, passwordChangedAt },
    });

    logSecurityEvent('auth.password.changed', req, { userId: user.id, email: user.email });

    res.cookie('token', token, COOKIE_OPTIONS);

    const isBearer = req.headers['authorization']?.startsWith('Bearer ');
    res.status(200).json({
      message: 'Password updated successfully.',
      ...(isBearer && { token }),
    });
  } catch (error) {
    reportServerError('Change password error', error);
    res.status(500).json({ error: { message: 'Failed to change password', code: 'CHANGE_PASSWORD_FAILED' } });
  }
};

export const registerDeviceTokenHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: errors.array() },
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
      return;
    }

    const { token, platform } = req.body;
    await registerDeviceToken(req.user.userId, token, platform);

    res.status(200).json({ message: 'Device token registered successfully.' });
  } catch (error) {
    reportServerError('Register device token error', error);
    res.status(500).json({ error: { message: 'Failed to register device token', code: 'REGISTER_DEVICE_TOKEN_FAILED' } });
  }
};

export const initiateEmailChangeHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: errors.array() },
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
      return;
    }

    const { email: newEmail } = req.body;

    // Anti-enumeration: respond identically whether or not the address is already
    // registered (mirrors forgot-password). Only actually issue a token + send the
    // confirmation link when the address is free; uniqueness is re-checked at
    // consume-time as the authoritative guard.
    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    const platform = req.headers['x-platform'] as string | undefined;
    logSecurityEvent('auth.email_change.requested', req, {
      userId: req.user.userId,
      ...(existing && { reason: 'email_taken' }),
    });
    if (!existing) {
      await initiateEmailChange(req.user.userId, newEmail, platform);
    }

    res.status(200).json({ message: 'Confirmation email sent. Check your inbox to complete the change.' });
  } catch (error) {
    reportServerError('Initiate email change error', error);
    res.status(500).json({ error: { message: 'Failed to initiate email change', code: 'EMAIL_CHANGE_FAILED' } });
  }
};

export const verifyEmailChange = async (req: AuthRequest, res: Response): Promise<void> => {
  // Prevent token leaking via Referer on every outcome
  res.setHeader('Referrer-Policy', 'no-referrer');
  const isMobile = req.query.platform === 'mobile';
  // Normalize so redirects survive env vars configured with or without trailing slashes
  const webUrl = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const mobileUrl = (process.env.MOBILE_URL || 'lifeadmin://').replace(/([^/])$/, '$1/');
  const url = (path: string) => isMobile ? `${mobileUrl}${path}` : `${webUrl}/${path}`;
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      logSecurityEvent('auth.email_change.failed', req, { reason: 'missing_token' });
      res.redirect(url('profile?error=invalid-token'));
      return;
    }

    const result = await consumeEmailChangeToken(token);

    if (!result.ok) {
      logSecurityEvent('auth.email_change.failed', req, { reason: result.reason });
      const errorParam = result.reason === 'email_taken' ? 'email-taken' : 'invalid-token';
      res.redirect(url(`profile?error=${errorParam}`));
      return;
    }

    logSecurityEvent('auth.email_change.completed', req, { userId: result.userId });
    res.redirect(url('profile?emailChanged=true'));
  } catch (error) {
    reportServerError('Verify email change error', error);
    res.redirect(url('profile?error=invalid-token'));
  }
};

export const resendVerification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Always return 200 with generic message (anti-enumeration)
    const genericResponse = {
      message: "If that email is registered and unverified, we've sent a verification link.",
    };

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(200).json(genericResponse);
      return;
    }

    const { email } = req.body;

    // Look up user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // No-op if user not found or already verified
    if (!user || user.emailVerified) {
      res.status(200).json(genericResponse);
      return;
    }

    // Issue new token and send email (don't block on failure)
    const platform = req.headers['x-platform'] as string | undefined;
    issueEmailVerificationToken(user.id, user.email, platform).catch((err) => {
      reportServerError('Failed to resend verification email', err);
    });

    res.status(200).json(genericResponse);
  } catch (error) {
    reportServerError('Resend verification error', error);
    res.status(200).json({
      message: "If that email is registered and unverified, we've sent a verification link.",
    });
  }
};
