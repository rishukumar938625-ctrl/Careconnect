import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/token.js';
import { User, IUser } from '../models/User.js';

export interface AuthRequest extends Request {
  user?: IUser;
}

/**
 * Authentication middleware that verifies session token from HttpOnly cookie
 * or Authorization Bearer header. Rejects unauthenticated requests with 401.
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.cookies?.careconnect_token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        status: 'error',
        message: 'Authentication required. Please sign in.',
      });
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      res.status(401).json({
        status: 'error',
        message: 'Your session has expired or is invalid. Please sign in again.',
      });
      return;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({
        status: 'error',
        message: 'User account not found.',
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        status: 'error',
        message: 'This account has been deactivated. Please contact support.',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Authentication failed.',
    });
  }
};

/**
 * Optional authentication middleware that attaches user if a valid session exists,
 * but allows guest access to continue if unauthenticated.
 */
export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token = req.cookies?.careconnect_token;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        const user = await User.findById(decoded.userId);
        if (user && user.isActive) {
          req.user = user;
        }
      }
    }
  } catch {
    // Continue without setting req.user
  }
  next();
};

/**
 * Role-based authorization middleware.
 */
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        message: 'Authentication required.',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        status: 'error',
        message: 'Access forbidden: you do not have permission to perform this action.',
      });
      return;
    }

    next();
  };
};
