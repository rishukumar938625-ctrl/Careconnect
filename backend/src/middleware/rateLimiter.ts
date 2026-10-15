import rateLimit from 'express-rate-limit';

/**
 * Strict limiter for authentication endpoints (login, register).
 * Prevents brute-force credential attacks.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 auth attempts per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
});

/**
 * Limiter for state-changing mutations (POST/PUT/PATCH/DELETE on resource routes).
 * Prevents automated bulk mutation abuse.
 */
export const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 mutations per IP per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many write requests from this IP. Please try again later.',
  },
});

/**
 * Limiter for search/catalog endpoints (public health info, doctor search).
 * Prevents scraping and DoS via expensive queries.
 */
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 read requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many search requests. Please slow down.',
  },
});

/**
 * General API fallback limiter applied globally.
 * Last-resort DoS / flood protection.
 */
export const globalApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // 300 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many requests from this IP. Please try again later.',
  },
});
