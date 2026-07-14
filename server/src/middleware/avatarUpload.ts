import { Response, NextFunction } from 'express';
import multer from 'multer';
import { AuthRequest } from './auth';

// Matches the "JPG or PNG, up to 2 MB" copy in the Settings UI.
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'] as const;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if ((ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('UNSUPPORTED_FILE_TYPE'));
    }
  },
}).single('file');

/**
 * Parse a single uploaded `file` (multipart/form-data) into memory, translating
 * multer errors into the app's standard `{ error: { message, code } }` envelope.
 */
export const avatarUpload = (req: AuthRequest, res: Response, next: NextFunction): void => {
  upload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const tooLarge = err.code === 'LIMIT_FILE_SIZE';
      res.status(400).json({
        error: {
          message: tooLarge ? 'File is too large (max 2 MB).' : `Upload error: ${err.message}`,
          code: tooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
        },
      });
      return;
    }
    if (err instanceof Error && err.message === 'UNSUPPORTED_FILE_TYPE') {
      res.status(400).json({
        error: {
          message: 'Unsupported file type. Upload a JPG or PNG.',
          code: 'UNSUPPORTED_FILE_TYPE',
        },
      });
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
};

// --- Per-user in-memory rate limit (bounds image-processing cost) ---
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

/**
 * Lightweight per-user throttle for avatar uploads. In-memory and per-process —
 * adequate for a single-instance MVP; revisit if the backend scales horizontally.
 */
export const avatarUploadRateLimit = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.user?.userId;
  if (!userId) {
    next();
    return;
  }

  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({
      error: {
        message: 'Too many uploads. Please wait a few minutes and try again.',
        code: 'RATE_LIMITED',
      },
    });
    return;
  }

  recent.push(now);
  hits.set(userId, recent);
  next();
};
