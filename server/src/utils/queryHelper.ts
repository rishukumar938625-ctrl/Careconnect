import { Request } from 'express';
import type { PaginationMeta } from '../types/index.js';

/**
 * Escapes special characters in a string for safe use in regular expressions.
 * Prevents regex injection and ReDoS attacks.
 */
export function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

/**
 * Parses and validates pagination query parameters with safe defaults and boundaries.
 */
export function parsePagination(req: Request, defaultLimit = 20, maxLimit = 50): PaginationParams {
  const pageRaw = Number(req.query.page);
  const limitRaw = Number(req.query.limit);

  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limit =
    Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, maxLimit) : defaultLimit;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Constructs standard pagination metadata.
 */
export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
