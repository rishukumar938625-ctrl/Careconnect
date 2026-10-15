import { Request, Response, NextFunction } from 'express';
import { sanitizeError } from '../utils/sanitize.js';
import type { ApiErrorResponse } from '../types/index.js';

interface CustomError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
  type?: string;
}

/**
 * Centralized Express Error Handler
 * Formats errors consistently, sanitizes messages, and prevents stack traces in production.
 */
export const errorHandler = (
  err: CustomError,
  _req: Request,
  res: Response<ApiErrorResponse>,
  // Express requires 4 arguments to recognize this as an error-handling middleware
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const isProduction = process.env.NODE_ENV === 'production';
  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle malformed JSON request body from express.json()
  if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON payload received';
  }

  // Handle CORS validation errors
  if (err.message && err.message.includes('not allowed by CORS')) {
    statusCode = 403;
    message = 'Cross-Origin Request Blocked: Origin not permitted';
  }

  // Handle Mongoose cast errors (e.g. invalid ObjectId format)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid resource identifier format';
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    // In production, strip internal field path details to prevent model enumeration
    if (isProduction) {
      message = 'Validation failed: one or more fields are invalid.';
    }
  }

  // Handle MongoDB duplicate key errors (E11000) - strip internal collection/index details
  if ((err as any).code === 11000) {
    statusCode = 409;
    message = isProduction
      ? 'A record with this value already exists.'
      : message; // keep detailed message in dev
  }

  // Sanitize the message to ensure no connection strings or secrets leak
  const sanitizedMessage = sanitizeError(message);

  const responseBody: ApiErrorResponse = {
    status: 'error',
    message: sanitizedMessage,
  };

  if (!isProduction && statusCode === 500 && err.stack) {
    responseBody.stack = sanitizeError(err.stack);
  }

  res.status(statusCode).json(responseBody);
};
