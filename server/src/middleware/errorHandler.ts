import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', err);

  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    Sentry.captureException(err);
  }

  const message = err.message || 'Internal server error';
  const code = err.code || 'INTERNAL_ERROR';

  res.status(statusCode).json({
    error: {
      message,
      code,
      details: err.details || {},
    },
  });
};
