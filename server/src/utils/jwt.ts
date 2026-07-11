import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
}

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};

// JWT `iat` claims are whole seconds (RFC 7519), and the auth middleware
// invalidates sessions where `iat < passwordChangedAt / 1000`. Floor the
// timestamp to the second so a token issued in the same second as the password
// change (e.g. the one re-issued by change-password) is not spuriously
// rejected for being a few milliseconds "older" than passwordChangedAt.
export const passwordChangedAtNow = (): Date => {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
};
