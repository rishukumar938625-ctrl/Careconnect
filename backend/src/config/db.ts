import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeError } from '../utils/sanitize.js';
import type { MongooseReadyState, DbConnectionStatus } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory first, fallback to root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const readyStateMap: Record<MongooseReadyState, DbConnectionStatus> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

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
 * Connects to MongoDB Atlas using Mongoose.
 * Reuses existing connection if already connected (prevents duplicate connections during development hot reloads).
 */
export const connectDB = async (): Promise<typeof mongoose> => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    const errorMsg = 'MONGODB_URI is not defined. Please set it in server/.env or .env';
    console.error(`❌ [Database] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Prevent duplicate connections on development hot-reloads (e.g. tsx watch)
  if (mongoose.connection.readyState === 1) {
    console.log('🔄 [Database] Reusing existing MongoDB connection.');
    return mongoose;
  }

  if (mongoose.connection.readyState === 2) {
    console.log('⏳ [Database] MongoDB is already connecting. Waiting for connection...');
    await new Promise<void>((resolve, reject) => {
      mongoose.connection.once('connected', () => resolve());
      mongoose.connection.once('error', (err) => reject(err));
    });
    return mongoose;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });

    console.log(`✅ [Database] MongoDB Connected successfully to database: "${conn.connection.name}"`);

    // Listen for connection events (attach only once)
    if (mongoose.connection.listenerCount('error') === 0) {
      mongoose.connection.on('error', (err) => {
        console.error('❌ [Database] Runtime connection error:', sanitizeError(err));
      });
    }

    if (mongoose.connection.listenerCount('disconnected') === 0) {
      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ [Database] MongoDB disconnected.');
      });
    }

    return conn;
  } catch (error) {
    const safeMsg = sanitizeError(error);
    console.error('❌ [Database] MongoDB connection failed:', safeMsg);

    // Provide specific, credential-safe guidance based on known error patterns
    if (safeMsg.includes('bad auth') || safeMsg.includes('Authentication failed')) {
      console.error(
        '👉 Configuration Diagnosis: Atlas database user authentication failed. Verify username and password in Atlas -> Database Access.'
      );
    } else if (safeMsg.includes('timed out') || safeMsg.includes('Server selection')) {
      console.error(
        '👉 Configuration Diagnosis: Atlas connection timed out. Verify your IP address is whitelisted in Atlas -> Network Access (or allow 0.0.0.0/0).'
      );
    } else if (safeMsg.includes('EBADNAME') || safeMsg.includes('querySrv')) {
      console.error(
        '👉 Configuration Diagnosis: DNS/SRV resolution failed. Ensure the cluster domain in MONGODB_URI is accurate and special characters in passwords are percent-encoded.'
      );
    }

    throw new Error(`Database connection failed: ${safeMsg}`);
  }
};

/**
 * Disconnects from MongoDB Atlas.
 */
export const disconnectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('🔌 [Database] MongoDB disconnected cleanly.');
  }
};
