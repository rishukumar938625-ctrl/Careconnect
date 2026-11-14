import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeError } from '../utils/sanitize.js';
import type { MongooseReadyState, DbConnectionStatus } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory first, fallback to root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const readyStateMap: Record<MongooseReadyState, DbConnectionStatus> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

// Concurrency control & background reconnection state
let connectingPromise: Promise<typeof mongoose> | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let isShuttingDown = false;

/**
 * Returns current database connection status without exposing sensitive information.
 */
export const getDbStatus = (): {
  isConnected: boolean;
  readyState: MongooseReadyState;
  status: DbConnectionStatus;
} => {
  const readyState = mongoose.connection.readyState as MongooseReadyState;
  return {
    isConnected: readyState === 1,
    readyState,
    status: readyStateMap[readyState] || 'disconnected',
  };
};

/**
 * Actively checks whether the database is responsive by sending a ping command.
 * Avoids false healthy reporting when a socket dropped but Mongoose has not yet
 * transitioned its readyState.
 */
export const checkDbAlive = async (timeoutMs = 2000): Promise<boolean> => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return false;
  }

  try {
    const pingPromise = mongoose.connection.db.admin().ping();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Database ping timed out')), timeoutMs)
    );

    await Promise.race([pingPromise, timeoutPromise]);
    return true;
  } catch (error) {
    console.warn('⚠️ [Database] Connection ping check failed:', sanitizeError(error));
    return false;
  }
};

/**
 * Logs credential-safe diagnostic messages based on known failure patterns.
 */
export const logDiagnosticGuidance = (safeMsg: string): void => {
  if (safeMsg.includes('bad auth') || safeMsg.includes('Authentication failed') || safeMsg.includes('code: 8000') || safeMsg.includes('code 8000')) {
    console.error(
      '👉 Configuration Diagnosis: Atlas database user authentication failed. Verify username and password in Atlas -> Database Access.'
    );
  } else if (safeMsg.includes('timed out') || safeMsg.includes('Server selection') || safeMsg.includes('ETIMEDOUT') || safeMsg.includes('ESOCKETTIMEDOUT')) {
    console.error(
      '👉 Configuration Diagnosis: Atlas connection timed out. Verify your IP address is whitelisted in Atlas -> Network Access (or allow 0.0.0.0/0).'
    );
  } else if (safeMsg.includes('EBADNAME') || safeMsg.includes('querySrv') || safeMsg.includes('ENOTFOUND') || safeMsg.includes('EAI_AGAIN')) {
    console.error(
      '👉 Configuration Diagnosis: DNS/SRV resolution failed. Ensure the cluster domain in MONGODB_URI is accurate and special characters in passwords are percent-encoded.'
    );
  } else if (safeMsg.includes('ECONNREFUSED') || safeMsg.includes('ECONNRESET') || safeMsg.includes('EHOSTUNREACH') || safeMsg.includes('ENETUNREACH')) {
    console.error(
      '👉 Configuration Diagnosis: Network connection to MongoDB host failed or was refused. Check network/firewall connectivity.'
    );
  }
};

/**
 * Schedules an automatic background reconnection attempt with exponential backoff.
 */
export const scheduleAutoReconnect = (delayMs = 5000): void => {
  if (isShuttingDown || reconnectTimer || mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return;
  }

  console.log(`⏳ [Database] Scheduling automatic background reconnection in ${delayMs / 1000}s...`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (isShuttingDown || mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
      return;
    }
    try {
      console.log('🔄 [Database] Attempting scheduled reconnection to MongoDB...');
      await connectDB();
    } catch (err) {
      console.warn('⚠️ [Database] Background reconnection failed:', sanitizeError(err));
      // Retry with backoff up to 30 seconds
      scheduleAutoReconnect(Math.min(delayMs * 1.5, 30000));
    }
  }, delayMs);
};

/**
 * Waits for an in-flight connection attempt to resolve.
 */
export const waitForConnection = async (timeoutMs = 5000): Promise<typeof mongoose> => {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (connectingPromise) {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection attempt timed out')), timeoutMs)
    );
    return Promise.race([connectingPromise, timeoutPromise]);
  }

  return connectDB();
};

/**
 * Connects to MongoDB Atlas using Mongoose.
 * Thread-safe: deduplicates concurrent connection attempts, reuses established
 * connections, and safely handles in-flight connecting/disconnecting states.
 */
export const connectDB = async (): Promise<typeof mongoose> => {
  isShuttingDown = false;

  // Clear any scheduled background timer since we are connecting now
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  // Reuse existing connection if already connected
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // If already connecting, return the in-flight promise
  if (connectingPromise) {
    return connectingPromise;
  }

  // If in the middle of disconnecting, wait for disconnect to complete before reconnecting
  if (mongoose.connection.readyState === 3) {
    console.log('⏳ [Database] MongoDB is disconnecting. Waiting for clean disconnect before reconnecting...');
    await new Promise<void>((resolve) => {
      if (mongoose.connection.readyState === 0) {
        resolve();
      } else {
        const onDisconnected = () => {
          mongoose.connection.off('disconnected', onDisconnected);
          resolve();
        };
        mongoose.connection.on('disconnected', onDisconnected);
        setTimeout(() => {
          mongoose.connection.off('disconnected', onDisconnected);
          resolve();
        }, 3000);
      }
    });
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    const errorMsg = 'MONGODB_URI is not defined. Please set it in backend/.env or .env';
    console.error(`❌ [Database] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  connectingPromise = (async () => {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      });

      console.log(`✅ [Database] MongoDB Connected successfully to database: "${conn.connection.name}"`);

      // Listen for runtime connection events (attach listeners only once)
      if (mongoose.connection.listenerCount('error') === 0) {
        mongoose.connection.on('error', (err) => {
          console.error('❌ [Database] Runtime connection error:', sanitizeError(err));
        });
      }

      if (mongoose.connection.listenerCount('disconnected') === 0) {
        mongoose.connection.on('disconnected', () => {
          console.warn('⚠️ [Database] MongoDB disconnected.');
          if (!isShuttingDown) {
            scheduleAutoReconnect(5000);
          }
        });
      }

      return conn;
    } catch (error) {
      const safeMsg = sanitizeError(error);
      console.error('❌ [Database] MongoDB connection failed:', safeMsg);
      logDiagnosticGuidance(safeMsg);

      if (!isShuttingDown) {
        scheduleAutoReconnect(5000);
      }

      throw new Error(`Database connection failed: ${safeMsg}`);
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
};

/**
 * Disconnects from MongoDB cleanly and cancels any pending reconnection tasks.
 */
export const disconnectDB = async (): Promise<void> => {
  isShuttingDown = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (connectingPromise) {
    try {
      await connectingPromise;
    } catch {
      // Ignore in-flight failure during shutdown
    }
    connectingPromise = null;
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('🔌 [Database] MongoDB disconnected cleanly.');
  }
};
