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
    const authHeader = req.headers['authorization'];
    const token =
      (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null) ??
      req.cookies.token;

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

    // Reject tokens issued before the last password reset (passwordChangedAt) or
    // the last logout (sessionsValidFrom). The JWT itself is stateless, so these
    // two timestamps are the only thing that can revoke a live token — whichever
    // is more recent wins.
    //
    // Resolution is one second, because that is all `iat` carries (RFC 7519).
    // A token minted in the same second as the cutoff is honoured: `iat` cannot
    // distinguish it from one minted a moment after, and rejecting it would lock
    // a user out of the login they just performed. The cost is a sub-second
    // window where the surviving token is one the user themselves just obtained
    // — not an attack. Do not "tighten" this to <= without reading LIF-126.
    if (decoded.iat) {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { passwordChangedAt: true, sessionsValidFrom: true },
      });
      const cutoff = Math.max(
        user?.passwordChangedAt?.getTime() ?? 0,
        user?.sessionsValidFrom?.getTime() ?? 0
      );
      if (cutoff > 0 && decoded.iat < cutoff / 1000) {
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
