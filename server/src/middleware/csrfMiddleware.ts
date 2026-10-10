import { Request, Response, NextFunction } from 'express';

const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const EXEMPT_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/logout'];

/**
 * Double-submit cookie CSRF protection middleware.
 * Verifies that state-changing requests accompanied by authentication cookies
 * include a matching X-CSRF-Token header.
 */
export const validateCsrf = (req: Request, res: Response, next: NextFunction): void => {
  // Safe read methods (GET, HEAD, OPTIONS) do not require CSRF token
  if (!MUTATION_METHODS.includes(req.method)) {
    return next();
  }

  // Exempt public auth actions
  if (EXEMPT_PATHS.some((path) => req.originalUrl?.startsWith(path))) {
    return next();
  }

  const authCookie = req.cookies?.careconnect_token;
  // If the request is not authenticated via cookie, CSRF check is not applicable
  if (!authCookie) {
    return next();
  }

  const csrfCookie = req.cookies?.careconnect_csrf_token;
  const csrfHeader = (req.headers['x-csrf-token'] as string) || (req.headers['x-xsrf-token'] as string);

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    res.status(403).json({
      status: 'error',
      message: 'CSRF validation failed: Invalid or missing security token.',
    });
    return;
  }

  next();
};
