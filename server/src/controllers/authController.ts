import { Response } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/db';
import { generateToken } from '../utils/jwt';
import { issueEmailVerificationToken, consumeEmailVerificationToken } from '../services/emailVerificationService';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
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
        createdAt: user.createdAt,
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
  res.clearCookie('token');
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
  try {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
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
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${clientUrl}/verify-email/error?reason=invalid`);
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
