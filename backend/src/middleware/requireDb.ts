import { Request, Response, NextFunction } from 'express';
import { getDbStatus } from '../config/db.js';

/**
 * Middleware that checks whether MongoDB is connected before forwarding
 * the request to route handlers.  When the database is disconnected
 * (e.g. Atlas IP not whitelisted, cluster unavailable) it immediately
 * returns a 503 Service Unavailable instead of letting Mongoose buffer
 * the operation for 10 seconds and then time out.
 *
 * This gives the frontend instant feedback and avoids long hanging requests.
 */
export const requireDb = (req: Request, res: Response, next: NextFunction): void => {
  const { isConnected, status } = getDbStatus();

  if (isConnected) {
    next();
    return;
  }

  res.status(503).json({
    status: 'error',
    message: 'Service temporarily unavailable — the database connection is not established. Please try again shortly.',
    dbStatus: status,
  });
};
