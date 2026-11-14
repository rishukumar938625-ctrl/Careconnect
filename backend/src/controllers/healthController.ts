import { Request, Response } from 'express';
import { getDbStatus, checkDbAlive, connectDB, waitForConnection } from '../config/db.js';
import { sanitizeError } from '../utils/sanitize.js';
import type { HealthResponse, DbHealthResponse } from '../types/index.js';

/**
 * GET /api/health
 * Reports backend server health and basic runtime statistics without disclosing secrets.
 */
export const getHealth = (_req: Request, res: Response<HealthResponse>): void => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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
 * Accurately verifies Mongoose connection state and actively pings the database.
 * If disconnected or in degraded state, attempts fresh connection / recovery.
 * Returns 200 if connected and verified responsive, 503 if disconnected.
 * Never exposes credentials, connection strings, or sensitive details.
 */
export const getDbHealth = async (_req: Request, res: Response<DbHealthResponse>): Promise<void> => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    let { isConnected, readyState, status } = getDbStatus();

    // 1. If currently connected, actively ping to verify responsiveness
    if (isConnected) {
      const isAlive = await checkDbAlive(2000);
      if (isAlive) {
        res.status(200).json({
          status: 'connected',
          database: 'connected',
          readyState: 1,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      console.warn('⚠️ [Health Check] Mongoose reports connected but ping check failed.');
    }

    // 2. If connection is in progress, wait briefly for it to complete
    if (readyState === 2) {
      try {
        await waitForConnection(3000);
        const isAlive = await checkDbAlive(2000);
        if (isAlive) {
          res.status(200).json({
            status: 'connected',
            database: 'connected',
            readyState: 1,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      } catch {
        // Connection attempt still in-flight or failed
      }
    }

    // 3. If disconnected (or ping failed), attempt fresh connection
    try {
      console.log('🔄 [Health Check] Database not established. Attempting connection check...');
      await connectDB();
      const isAlive = await checkDbAlive(2000);
      if (isAlive) {
        res.status(200).json({
          status: 'connected',
          database: 'connected',
          readyState: 1,
          timestamp: new Date().toISOString(),
        });
        return;
      }
    } catch (connectErr) {
      console.warn('⚠️ [Health Check] Fresh connection attempt failed:', sanitizeError(connectErr));
    }

    // Re-check current status after attempt
    const current = getDbStatus();
    res.status(503).json({
      status: current.status,
      database: 'disconnected',
      readyState: current.readyState,
      timestamp: new Date().toISOString(),
      message: 'Database connection is not established',
    });
  } catch (error) {
    console.error('❌ [Health Check] Unexpected error during DB health check:', sanitizeError(error));
    const current = getDbStatus();
    res.status(503).json({
      status: current.status,
      database: 'disconnected',
      readyState: current.readyState,
      timestamp: new Date().toISOString(),
      message: 'Database connection is not established',
    });
  }
};
