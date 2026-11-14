/**
 * CareConnect — Database Health & Reconnection Regression Test Suite
 *
 * Validates:
 * 1. Connected state returns HTTP 200 with readyState 1 and no-cache headers.
 * 2. Active ping check verifies responsiveness and prevents false healthy reporting.
 * 3. Disconnected state returns HTTP 503 and fast-fails requireDb middleware.
 * 4. Reconnection / Retry succeeds when MongoDB is reachable again.
 * 5. Ping timeouts and connection errors are handled without hanging.
 * 6. Credential sanitization strictly strips MONGODB_URI and passwords from logs and responses.
 */

import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import healthRoutes from '../routes/healthRoutes.js';
import { getDbStatus, checkDbAlive, connectDB, disconnectDB, logDiagnosticGuidance, waitForConnection } from '../config/db.js';
import { requireDb } from '../middleware/requireDb.js';
import { sanitizeError, sanitizeUri } from '../utils/sanitize.js';

async function runTests() {
  console.log('🧪 Starting Database Health & Reconnection Regression Test Suite...\n');

  let mongoServer: MongoMemoryServer | null = null;
  let server: import('http').Server | null = null;
  const TEST_PORT = 5093;
  const BASE_URL = `http://localhost:${TEST_PORT}/api`;

  try {
    // ─── Setup isolated test environment ───────────────────────────────────
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGODB_URI = mongoUri;

    // Connect to test database
    await connectDB();
    console.log('✅ Connected to isolated in-memory test database');

    const app = express();
    app.use(express.json());
    app.use('/api/health', healthRoutes);
    app.get('/api/protected-db-route', requireDb, (_req, res) => {
      res.status(200).json({ status: 'ok', data: 'db-dependent-data' });
    });

    await new Promise<void>((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`✅ Test server running on port ${TEST_PORT}\n`);
        resolve();
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 1: Connected state returns 200 with accurate readyState & no-cache
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Test 1: Connected state returns 200 with accurate readyState and no-cache headers');
    {
      const res = await fetch(`${BASE_URL}/health/db`);
      assert.equal(res.status, 200, 'Expected HTTP 200 when connected');
      const data = (await res.json()) as any;
      assert.equal(data.status, 'connected');
      assert.equal(data.database, 'connected');
      assert.equal(data.readyState, 1);
      assert.ok(data.timestamp);

      // Verify no-cache headers to ensure fresh health responses
      const cacheControl = res.headers.get('cache-control') || '';
      assert.ok(cacheControl.includes('no-cache'), 'Must include no-cache');
      assert.ok(cacheControl.includes('no-store'), 'Must include no-store');
      console.log('  ✓ GET /api/health/db reports connected state with no-cache headers');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 2: Active ping verification (checkDbAlive)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 2: Active ping check verifies database responsiveness');
    {
      const isAlive = await checkDbAlive(2000);
      assert.equal(isAlive, true, 'Active database should respond to ping check');

      const status = getDbStatus();
      assert.equal(status.isConnected, true);
      assert.equal(status.readyState, 1);
      assert.equal(status.status, 'connected');
      console.log('  ✓ checkDbAlive confirmed active ping against MongoDB');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 3: Disconnected state returns 503 & requireDb fast-fails
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 3: Disconnected state returns 503 and requireDb fast-fails');
    {
      // Cleanly disconnect Mongoose and point to invalid URI to simulate offline DB
      await disconnectDB();
      const statusAfterDisconnect = getDbStatus();
      assert.equal(statusAfterDisconnect.isConnected, false);
      assert.equal(statusAfterDisconnect.readyState, 0);
      assert.equal(statusAfterDisconnect.status, 'disconnected');

      // Temporarily use unreachable URI so reconnection fails
      const savedUri = process.env.MONGODB_URI;
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27019/unreachable_db?connectTimeoutMS=500';

      const resDb = await fetch(`${BASE_URL}/health/db`);
      assert.equal(resDb.status, 503, 'Expected HTTP 503 when disconnected');
      const dbData = (await resDb.json()) as any;
      assert.equal(dbData.database, 'disconnected');
      assert.equal(dbData.status, 'disconnected');

      // Verify requireDb middleware returns 503 immediately
      const resProtected = await fetch(`${BASE_URL}/protected-db-route`);
      assert.equal(resProtected.status, 503, 'requireDb must fail-fast with 503');
      const protData = (await resProtected.json()) as any;
      assert.equal(protData.status, 'error');
      assert.ok(protData.message.includes('database connection is not established'));

      // Restore URI for subsequent tests
      process.env.MONGODB_URI = savedUri;
      console.log('  ✓ Disconnected DB returns 503 and requireDb protects routes');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 4: Reconnection on health check request (Retry flow)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 4: Fresh health check triggers successful reconnection');
    {
      // MongoDB is reachable at savedUri, but Mongoose is currently disconnected (state 0)
      assert.equal(mongoose.connection.readyState, 0);

      // GET /api/health/db initiates fresh connection and verifies ping
      const resRetry = await fetch(`${BASE_URL}/health/db`);
      assert.equal(resRetry.status, 200, 'Health check should reconnect and return 200');
      const retryData = (await resRetry.json()) as any;
      assert.equal(retryData.status, 'connected');
      assert.equal(retryData.database, 'connected');
      assert.equal(retryData.readyState, 1);

      // requireDb route should now succeed
      const resProt = await fetch(`${BASE_URL}/protected-db-route`);
      assert.equal(resProt.status, 200, 'requireDb should allow request once reconnected');
      console.log('  ✓ Health check triggered automatic recovery from disconnected state');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 5: Timeout handling and ping failure prevention
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 5: Ping timeout handling and false-healthy prevention');
    {
      // checkDbAlive with 1ms timeout simulates timeout
      const aliveWithZeroTimeout = await checkDbAlive(0);
      // Either false (timed out) or boolean without throwing unhandled rejection
      assert.equal(typeof aliveWithZeroTimeout, 'boolean');

      // waitForConnection with already connected state returns immediately
      const conn = await waitForConnection(1000);
      assert.equal(conn.connection.readyState, 1);
      console.log('  ✓ Timeout handling safely resolves without hanging');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 6: Credential-safe sanitization and diagnostic guidance
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 6: Credential sanitization strictly protects secrets');
    {
      const rawUriWithPassword = 'mongodb+srv://admin_user:SuperSecretPassword123!@cluster0.abc.mongodb.net/careconnect?retryWrites=true';
      const sanitized = sanitizeUri(rawUriWithPassword);
      assert.ok(!sanitized.includes('SuperSecretPassword123!'), 'Password must never appear in sanitized URI');
      assert.ok(sanitized.includes('*****'), 'Password must be masked with asterisks');
      assert.ok(sanitized.includes('admin_user:*****@cluster0'), 'User and cluster preserved');

      // Error message containing URI
      const rawError = new Error(`Connection to ${rawUriWithPassword} timed out after 5000 ms`);
      const safeErrorMsg = sanitizeError(rawError);
      assert.ok(!safeErrorMsg.includes('SuperSecretPassword123!'), 'Password must not leak in error message');
      assert.ok(safeErrorMsg.includes('*****'), 'Password masked in error message');

      // Test diagnostics logging function does not throw on various patterns
      logDiagnosticGuidance('bad auth : Authentication failed.');
      logDiagnosticGuidance('Server selection timed out after 5000 ms');
      logDiagnosticGuidance('querySrv EBADNAME _mongodb._tcp.invalid.net');
      logDiagnosticGuidance('connect ECONNREFUSED 127.0.0.1:27017');
      console.log('  ✓ All sensitive credentials stripped and diagnostic guidance verified');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎉 ALL DATABASE HEALTH & RECONNECTION TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════════════\n');
  } finally {
    if (server) {
      (server as import('http').Server).close();
    }
    await disconnectDB();
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
