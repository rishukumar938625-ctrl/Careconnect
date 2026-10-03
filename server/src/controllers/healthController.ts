import { Request, Response } from 'express';
import { getDbStatus } from '../config/db.js';
import type { HealthResponse, DbHealthResponse } from '../types/index.js';

/**
 * GET /api/health
 * Reports backend server health and basic runtime statistics without disclosing secrets.
 */
export const getHealth = (_req: Request, res: Response<HealthResponse>): void => {
  res.status(200).json({
    status: 'ok',
    service: 'CareConnect Backend API',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
  });
};

/**
 * GET /api/health/db
 * Checks the actual Mongoose connection state.
 * Returns 200 if connected, 503 if disconnected or connecting.
 * Does not expose connection strings, database credentials, or sensitive details.
 */
export const getDbHealth = (_req: Request, res: Response<DbHealthResponse>): void => {
  const { isConnected, readyState, status } = getDbStatus();

  if (isConnected) {
    res.status(200).json({
      status: 'connected',
      database: 'connected',
      readyState,
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status,
      database: 'disconnected',
      readyState,
      timestamp: new Date().toISOString(),
      message: 'Database connection is not established',
    });
  }
};
