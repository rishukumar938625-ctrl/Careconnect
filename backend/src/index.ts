import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, disconnectDB } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { sanitizeError } from './utils/sanitize.js';

import cookieParser from 'cookie-parser';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import conditionRoutes from './routes/conditionRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import articleRoutes from './routes/articleRoutes.js';
import medicationRoutes from './routes/medicationRoutes.js';
import doseRoutes from './routes/doseRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import userRoutes from './routes/userRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { defaultWorker } from './services/notificationWorker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (backend directory has precedence, root directory as fallback)
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ─── Security & Parsing Middleware ──────────────────────────────────────────

// Configure CORS for local frontend origin
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = [
  frontendUrl,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl, Postman, health probes)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-csrf-token'],
  })
);

// Cookie parsing middleware
app.use(cookieParser());

// Safe JSON and URL-encoded request body parsing with sensible size limits (1mb)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── API Routes ─────────────────────────────────────────────────────────────

// Health endpoints (/api/health and /api/health/db) and health data routes
app.use('/api/health', healthRoutes);

// Phase 3 Authentication Endpoints
app.use('/api/auth', authRoutes);

// Phase 2 Health Information Module Endpoints
app.use('/api/conditions', conditionRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/articles', articleRoutes);

// Feature routes
app.use('/api/medications', medicationRoutes);
app.use('/api/doses', doseRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/user', userRoutes);
app.use('/api/notifications', notificationRoutes);

// ─── Error Handling & 404 Fallbacks ─────────────────────────────────────────

// 404 handler for unknown routes
app.use(notFoundHandler);

// Centralized error handling middleware
app.use(errorHandler);

// ─── Server Lifecycle & Startup ─────────────────────────────────────────────

const startServer = async () => {
  try {
    // Attempt MongoDB Atlas connection
    await connectDB();
  } catch (error) {
    // Do not fail silently: output a clear, credential-safe error banner
    console.error('⚠️ [Server Warning] MongoDB connection could not be established at startup:');
    console.error(`   ${sanitizeError(error)}`);
    console.error('⚠️ [Server Warning] Starting Express server in degraded mode.');
    console.error('   Inspect GET /api/health/db to verify database connection status.');
  }

  // Optionally launch background notification worker if enabled in configuration
  if (process.env.WORKER_ENABLED === 'true') {
    defaultWorker.start();
  }

  const listenOnPort = (portToTry: number, retriesLeft = 1): Promise<import('http').Server> => {
    return new Promise((resolve, reject) => {
      const s = app.listen(portToTry, () => {
        console.log(`🚀 CareConnect API Server running on port ${portToTry} [${NODE_ENV}]`);
        console.log(`📡 Health Check URL:    http://localhost:${portToTry}/api/health`);
        console.log(`🔍 DB Health Check URL: http://localhost:${portToTry}/api/health/db`);
        resolve(s);
      });

      s.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && retriesLeft > 0) {
          console.warn(`⚠️ [Server] Port ${portToTry} is in use (often used by macOS AirPlay Receiver). Retrying on port ${portToTry + 1}...`);
          resolve(listenOnPort(portToTry + 1, retriesLeft - 1));
        } else {
          reject(err);
        }
      });
    });
  };

  const server = await listenOnPort(PORT);

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
    if (process.env.WORKER_ENABLED === 'true') {
      await defaultWorker.stop();
    }
    server.close(async () => {
      await disconnectDB();
      console.log('✅ CareConnect API Server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

startServer();

export default app;
