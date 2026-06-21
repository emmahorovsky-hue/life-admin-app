import { Request, Response, NextFunction } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;
  const isServerError = statusCode >= 500;

  // Sentry capture is handled upstream by setupExpressErrorHandler in index.ts.
  // In production, never leak raw error internals for server errors — they can
  // contain Prisma messages, stack traces, or DB connection strings.
  const message = isServerError && isProduction
    ? 'Something went wrong. Please try again later.'
    : err.message || 'Internal server error';

  const code = err.code || 'INTERNAL_ERROR';

  const details = isServerError && isProduction ? {} : err.details || {};

  res.status(statusCode).json({
    error: {
      message,
      code,
      details,
    },
  });
};
