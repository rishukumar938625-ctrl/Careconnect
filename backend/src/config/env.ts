/**
 * CareConnect — Production Environment Validation & Configuration Module
 *
 * Ensures all required environment variables are present and cryptographically sound
 * before the application begins accepting incoming HTTP traffic.
 *
 * Prevents accidental startup with missing configurations, weak secrets, or unsafe defaults.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env files are loaded in predictable hierarchical order
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  frontendUrl: string;
  mongoUri: string;
  jwtSecret: string;
  cookieSameSite: 'strict' | 'lax' | 'none';
  cookieDomain?: string;
  cookieSecure: boolean;
  trustProxy: boolean;
  workerEnabled: boolean;
  workerPollIntervalMs: number;
  workerBatchSize: number;
  workerLeaseDurationMs: number;
  emailProvider: 'simulated' | 'smtp';
  fromEmail: string;
}

export interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config: AppConfig;
}

/**
 * Validates the runtime environment according to deployment target requirements.
 */
export function validateEnv(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawNodeEnv = process.env.NODE_ENV || 'development';
  const nodeEnv: 'development' | 'production' | 'test' =
    rawNodeEnv === 'production' ? 'production' : rawNodeEnv === 'test' ? 'test' : 'development';

  const port = Number(process.env.PORT) || 5000;
  const isProd = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  // 1. MongoDB Connection String
  const mongoUri = process.env.MONGODB_URI || '';
  if (!mongoUri && !isTest) {
    errors.push('MONGODB_URI is required. Please provide a valid MongoDB connection string.');
  } else if (mongoUri && !mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
    errors.push('MONGODB_URI must start with "mongodb://" or "mongodb+srv://".');
  }

  // 2. JWT Signing Secret
  const jwtSecret = process.env.JWT_SECRET || (isTest ? 'phase9-test-jwt-secret-key-32-chars-long' : '');
  if (!jwtSecret && !isTest) {
    errors.push('JWT_SECRET is required.');
  } else if (isProd && jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long in production to resist brute-force attacks.');
  }

  // 3. Frontend Origin & CORS
  const frontendUrl = process.env.FRONTEND_URL || (isProd ? '' : 'http://localhost:5173');
  if (isProd && !frontendUrl) {
    errors.push('FRONTEND_URL is required in production for CORS origin restriction.');
  } else if (frontendUrl && !frontendUrl.startsWith('http://') && !frontendUrl.startsWith('https://')) {
    errors.push('FRONTEND_URL must be a valid absolute URL starting with http:// or https://.');
  }

  // 4. Cookie Configuration
  let cookieSameSite: 'strict' | 'lax' | 'none' = isProd ? 'strict' : 'lax';
  if (process.env.COOKIE_SAME_SITE) {
    const rawSameSite = process.env.COOKIE_SAME_SITE.toLowerCase();
    if (['strict', 'lax', 'none'].includes(rawSameSite)) {
      cookieSameSite = rawSameSite as 'strict' | 'lax' | 'none';
    } else {
      warnings.push(`Invalid COOKIE_SAME_SITE "${process.env.COOKIE_SAME_SITE}". Defaulting to "${cookieSameSite}".`);
    }
  }

  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  let cookieSecure = isProd;
  if (process.env.COOKIE_SECURE !== undefined) {
    cookieSecure = process.env.COOKIE_SECURE === 'true';
  }

  // If sameSite is 'none', browser standards REQUIRE secure=true
  if (cookieSameSite === 'none' && !cookieSecure) {
    if (isProd) {
      errors.push('COOKIE_SAME_SITE="none" requires COOKIE_SECURE="true" (HTTPS) per modern browser cookie standards.');
    } else {
      warnings.push('COOKIE_SAME_SITE="none" usually requires HTTPS; cookies may be rejected by browsers on insecure origins.');
    }
  }

  // 5. Reverse Proxy Trust
  const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1' || isProd;

  // 6. Background Worker Settings
  const workerEnabled = process.env.WORKER_ENABLED === 'true';
  const workerPollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS) || 5000;
  const workerBatchSize = Number(process.env.WORKER_BATCH_SIZE) || 10;
  const workerLeaseDurationMs = Number(process.env.WORKER_LEASE_DURATION_MS) || 60000;

  // 7. Email Settings
  const emailProvider = (process.env.EMAIL_PROVIDER?.toLowerCase() === 'smtp' ? 'smtp' : 'simulated') as 'simulated' | 'smtp';
  const fromEmail = process.env.FROM_EMAIL || 'notifications@careconnect.app';

  if (emailProvider === 'smtp' && isProd) {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      warnings.push('EMAIL_PROVIDER=smtp specified, but SMTP_HOST, SMTP_USER, or SMTP_PASS is missing. Emails may fail to deliver.');
    }
  }

  const config: AppConfig = {
    port,
    nodeEnv,
    frontendUrl,
    mongoUri,
    jwtSecret,
    cookieSameSite,
    cookieDomain,
    cookieSecure,
    trustProxy,
    workerEnabled,
    workerPollIntervalMs,
    workerBatchSize,
    workerLeaseDurationMs,
    emailProvider,
    fromEmail,
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    config,
  };
}

/**
 * Asserts that the environment is valid.
 * Prints safe diagnostics and aborts startup with exit code 1 if fatal errors exist.
 */
export function assertValidEnv(): AppConfig {
  const result = validateEnv();

  if (result.warnings.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn('\n⚠️ [Environment Warnings]:');
    result.warnings.forEach((w) => console.warn(`   • ${w}`));
  }

  if (!result.isValid) {
    console.error('\n❌ [Fatal Environment Configuration Errors]:');
    result.errors.forEach((err) => console.error(`   • ${err}`));
    console.error('\nServer startup aborted due to invalid production configuration.\n');
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    } else {
      throw new Error(`Environment validation failed: ${result.errors.join('; ')}`);
    }
  }

  return result.config;
}
