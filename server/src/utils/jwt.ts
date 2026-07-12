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
// invalidates any token whose `iat` predates one of these cutoffs. Floor the
// timestamp to the second so a token issued in the same second as the cutoff is
// not spuriously rejected for being a few milliseconds "older" than it — which
// would otherwise lock the user out on two real flows: the token re-issued by
// change-password, and a login immediately following a logout.
const flooredNow = (): Date => new Date(Math.floor(Date.now() / 1000) * 1000);

export const passwordChangedAtNow = flooredNow;
export const sessionsValidFromNow = flooredNow;
