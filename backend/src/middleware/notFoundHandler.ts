import { Request, Response } from 'express';
import type { ApiErrorResponse } from '../types/index.js';

/**
 * 404 Not Found Middleware
 * Handles requests to endpoints that do not exist.
 */
export const notFoundHandler = (req: Request, res: Response<ApiErrorResponse>): void => {
  res.status(404).json({
    status: 'error',
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
  });
};
