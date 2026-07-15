import { Response } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/db';
import { reportServerError } from '../utils/reportError';
import { logSecurityEvent } from '../utils/securityLog';
import { sendAccountDeletedEmail } from '../services/emailService';
import { PUBLIC_USER_SELECT, toPublicUser } from '../constants/user';
import { COOKIE_OPTIONS } from './authController';

// Square cover crop at avatar display size; WebP keeps the stored blob small
// (a 256px avatar lands well under 30 KB, so Postgres storage stays cheap).
const AVATAR_SIZE = 256;
const AVATAR_WEBP_QUALITY = 82;

async function freshPublicUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_USER_SELECT,
  });
  return user ? toPublicUser(user) : null;
}

export const uploadAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: { message: 'No file uploaded.', code: 'NO_FILE' } });
      return;
    }

    // .rotate() applies the EXIF orientation before it is stripped by
    // re-encoding, so phone photos don't come out sideways.
    let processed: Buffer;
    try {
      processed = await sharp(req.file.buffer)
        .rotate()
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
        .webp({ quality: AVATAR_WEBP_QUALITY })
        .toBuffer();
    } catch {
      // Mime type passed the filter but the bytes aren't a decodable image.
      res.status(400).json({
        error: { message: 'That file could not be read as an image.', code: 'INVALID_IMAGE' },
      });
      return;
    }

    await prisma.userAvatar.upsert({
      where: { userId: req.user.userId },
      create: { userId: req.user.userId, data: processed, mimeType: 'image/webp' },
      update: { data: processed, mimeType: 'image/webp' },
    });

    res.status(200).json({ user: await freshPublicUser(req.user.userId) });
  } catch (error) {
    reportServerError('Avatar upload error', error);
    res.status(500).json({
      error: { message: 'Failed to upload avatar', code: 'AVATAR_UPLOAD_FAILED' },
    });
  }
};

export const getAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
      return;
    }

    const avatar = await prisma.userAvatar.findUnique({ where: { userId: req.user.userId } });
    if (!avatar) {
      res.status(404).json({ error: { message: 'No avatar set.', code: 'NO_AVATAR' } });
      return;
    }

    // The client cache-busts with ?v=<avatarUpdatedAt>, so the ETag mostly
    // serves conditional revalidation within one avatar version.
    const etag = `"${avatar.updatedAt.getTime()}"`;
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res
      .status(200)
      .set({
        'Content-Type': avatar.mimeType,
        ETag: etag,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      })
      .send(Buffer.from(avatar.data));
  } catch (error) {
    reportServerError('Avatar fetch error', error);
    res.status(500).json({ error: { message: 'Failed to fetch avatar', code: 'AVATAR_FETCH_FAILED' } });
  }
};

export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const { password } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      res.status(404).json({ error: { message: 'User not found', code: 'USER_NOT_FOUND' } });
      return;
    }

    // Deleting an account is irreversible — re-authenticate with the current
    // password so a hijacked session can't silently destroy the account.
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      logSecurityEvent('account.delete_failed', req, {
        userId: user.id,
        email: user.email,
        reason: 'invalid_password',
      });
      res.status(400).json({
        error: { message: 'Current password is incorrect', code: 'INVALID_CURRENT_PASSWORD' },
      });
      return;
    }

    // NotificationLog rows reference the user by bare id (no FK), so the
    // cascade on user delete misses them — remove them in the same transaction.
    // Everything else (subscriptions, tokens, device tokens, avatar) cascades.
    await prisma.$transaction([
      prisma.notificationLog.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    logSecurityEvent('account.deleted', req, { userId: user.id, email: user.email });

    // Best-effort farewell only after the delete committed — a mailer outage
    // must never fail (or roll back) the deletion itself.
    try {
      await sendAccountDeletedEmail({ to: user.email });
    } catch (error) {
      reportServerError('Failed to send account-deleted email', error);
    }

    // The row is gone, so there is no sessionsValidFrom left to stamp — clearing
    // the cookie (same attributes it was set with) plus client-side teardown is
    // the whole logout story here.
    res.clearCookie('token', {
      httpOnly: COOKIE_OPTIONS.httpOnly,
      secure: COOKIE_OPTIONS.secure,
      sameSite: COOKIE_OPTIONS.sameSite,
    });
    res.status(200).json({ message: 'Account deleted' });
  } catch (error) {
    reportServerError('Account deletion error', error);
    res.status(500).json({
      error: { message: 'Failed to delete account', code: 'ACCOUNT_DELETE_FAILED' },
    });
  }
};

export const deleteAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: { message: 'Not authenticated', code: 'NOT_AUTHENTICATED' } });
      return;
    }

    // deleteMany so removing an avatar that never existed stays a 200 (idempotent).
    await prisma.userAvatar.deleteMany({ where: { userId: req.user.userId } });

    res.status(200).json({ user: await freshPublicUser(req.user.userId) });
  } catch (error) {
    reportServerError('Avatar delete error', error);
    res.status(500).json({
      error: { message: 'Failed to delete avatar', code: 'AVATAR_DELETE_FAILED' },
    });
  }
};
