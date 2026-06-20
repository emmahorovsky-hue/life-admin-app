import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../utils/db';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.cookies.token;

    if (!token) {
      res.status(401).json({
        error: {
          message: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
      });
      return;
    }

    const decoded = verifyToken(token);

    // Reject tokens issued before the last password reset
    if (decoded.iat) {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { passwordChangedAt: true },
      });
      if (user?.passwordChangedAt && decoded.iat < user.passwordChangedAt.getTime() / 1000) {
        res.status(401).json({
          error: {
            message: 'Session invalidated. Please log in again.',
            code: 'SESSION_INVALIDATED',
          },
        });
        return;
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      error: {
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      },
    });
  }
};
