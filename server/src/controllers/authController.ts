import { Response } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/db';
import { generateToken } from '../utils/jwt';
import { issueEmailVerificationToken, consumeEmailVerificationToken } from '../services/emailVerificationService';
import { issuePasswordResetToken, consumePasswordResetToken } from '../services/passwordResetService';

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
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Issue email verification token and send email. Await token creation
    // so tests and cleanup won't race with a background task. Sending the
    // actual email is handled inside the service and can fail independently.
    try {
      await issueEmailVerificationToken(user.id, user.email);
    } catch (err) {
      console.error('Failed to send verification email:', err);
    }

    // Generate JWT
    const token = generateToken({ userId: user.id, email: user.email });

    // Set cookie
    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(201).json({
      message: 'User registered successfully',
      user,
    });
  } catch (error) {
    console.error('Register error:', error);
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
      res.status(401).json({
        error: {
          message: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        },
      });
      return;
    }

    // Generate JWT
    const token = generateToken({ userId: user.id, email: user.email });

    // Set cookie
    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to login',
        code: 'LOGIN_FAILED',
      },
    });
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
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
        emailVerified: true,
        emailVerifiedAt: true,
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
    console.error('GetMe error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch user',
        code: 'FETCH_USER_FAILED',
      },
    });
  }
};

export const verifyEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      res.redirect(`${clientUrl}/verify-email/error?reason=invalid`);
      return;
    }

    const result = await consumeEmailVerificationToken(token);

    if (!result.ok) {
      res.redirect(`${clientUrl}/verify-email/error?reason=${result.reason}`);
      return;
    }

    res.setHeader('Referrer-Policy', 'no-referrer');
    res.redirect(`${clientUrl}/verify-email/success`);
  } catch (error) {
    console.error('Verify email error:', error);
    res.redirect(`${clientUrl}/verify-email/error?reason=invalid`);
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
      res.status(200).json(genericResponse);
      return;
    }

    issuePasswordResetToken(user.id, user.email).catch((err) => {
      console.error('Failed to send password reset email:', err);
    });

    res.status(200).json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
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
        data: { password: hashedPassword, passwordChangedAt: now },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: result.userId, usedAt: null },
        data: { usedAt: now },
      }),
    ]);

    res.status(200).json({ message: 'Password reset successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: { message: 'Failed to reset password', code: 'RESET_PASSWORD_FAILED' },
    });
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
    issueEmailVerificationToken(user.id, user.email).catch((err) => {
      console.error('Failed to resend verification email:', err);
    });

    res.status(200).json(genericResponse);
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(200).json({
      message: "If that email is registered and unverified, we've sent a verification link.",
    });
  }
};
