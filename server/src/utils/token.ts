import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not defined in production.');
    }
    return 'careconnect-development-fallback-secret-key-3.0';
  }
  return secret;
}

/**
 * Generate a signed JWT valid for 7 days
 */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: '7d',
    issuer: 'careconnect-auth',
    audience: 'careconnect-client',
  });
}

/**
 * Verify JWT token and return decoded payload
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      issuer: 'careconnect-auth',
      audience: 'careconnect-client',
    });
    return decoded as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Generate a cryptographically secure random token for CSRF protection
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
