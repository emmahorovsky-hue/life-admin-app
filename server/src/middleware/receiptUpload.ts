import { Response, NextFunction } from 'express';
import multer from 'multer';
import { AuthRequest } from './auth';
import { ALLOWED_UPLOAD_MIME_TYPES } from '../services/aiService';
import { retryAfterSeconds } from './rateLimit';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if ((ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
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
export const receiptUpload = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  upload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const tooLarge = err.code === 'LIMIT_FILE_SIZE';
      res.status(400).json({
        error: {
          message: tooLarge
            ? 'File is too large (max 10 MB).'
            : `Upload error: ${err.message}`,
          code: tooLarge ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
        },
      });
      return;
    }
    if (err instanceof Error && err.message === 'UNSUPPORTED_FILE_TYPE') {
      res.status(400).json({
        error: {
          message: 'Unsupported file type. Upload a PDF, PNG, JPEG, or WebP.',
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

// --- Per-user in-memory rate limit (bounds LLM cost) ---
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

/**
 * Lightweight per-user throttle for the extraction endpoint. In-memory and per-process —
 * adequate for a single-instance MVP; revisit if the backend scales horizontally.
 */
export const extractRateLimit = (
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
    // `recent` is ascending (entries are pushed in time order), so the oldest
    // hit is the first slot to fall out of the window. Clients read this to
    // decide when to re-enable a retry — without it they can only guess, and a
    // guess that is too short spends another request on a limiter already
    // refusing them.
    res.setHeader('Retry-After', retryAfterSeconds(recent[0], now, WINDOW_MS));
    res.status(429).json({
      error: {
        message: 'Too many extraction requests. Please wait a few minutes and try again.',
        code: 'RATE_LIMITED',
      },
    });
    return;
  }

  recent.push(now);
  hits.set(userId, recent);
  next();
};
