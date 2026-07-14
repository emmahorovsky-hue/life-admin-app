import { Response } from 'express';
import sharp from 'sharp';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/db';
import { reportServerError } from '../utils/reportError';
import { PUBLIC_USER_SELECT, toPublicUser } from '../constants/user';

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
