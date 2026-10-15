import { Request, Response, NextFunction } from 'express';

/**
 * Recursively removes keys that start with '$' or contain '.' from an object.
 * This prevents NoSQL injection attacks using MongoDB operators
 * such as $gt, $ne, $regex, $where in query params and body payloads.
 */
function sanitizeObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    // Strip keys starting with '$' (MongoDB operators) or containing '.' (dot notation injection)
    if (key.startsWith('$') || key.includes('.')) {
      continue;
    }
    sanitized[key] = sanitizeObject((obj as Record<string, unknown>)[key]);
  }
  return sanitized;
}

/**
 * Middleware that sanitizes request body and query params to prevent NoSQL injection.
 * Applied globally before route handlers.
 */
export const sanitizeNoSql = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    const sanitizedQuery = sanitizeObject(req.query);
    // Replace the query object's properties in-place (req.query is not directly reassignable)
    for (const key of Object.keys(req.query)) {
      delete req.query[key];
    }
    Object.assign(req.query, sanitizedQuery);
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params) as Record<string, string>;
  }

  next();
};
