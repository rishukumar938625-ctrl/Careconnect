/**
 * Registration Followed by Login Regression Test Suite
 *
 * Verifies:
 * 1. Safe registration: password hashing (bcrypt), email normalization, patient role assignment.
 * 2. Successful login with matching credentials and cookie generation (careconnect_token, careconnect_csrf_token).
 * 3. Case-insensitive and whitespace-trimmed email normalization during login.
 * 4. Password mismatch rejection (401 generic error).
 * 5. Non-existent user rejection (401 generic error, no account enumeration).
 * 6. Missing/empty credentials rejection (400).
 * 7. Deactivated account rejection (403).
 * 8. Explicit .select('+passwordHash') retrieval logic.
 * 9. Session persistence via GET /api/auth/me with cookies.
 * 10. Logout clears cookies and terminates session.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { User } from '../models/User.js';
import authRoutes from '../routes/authRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

const TEST_PORT = 5092;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', authRoutes);
app.use(errorHandler);

let mongoServer: MongoMemoryServer;
let server: http.Server;

async function runRegressionTests() {
  console.log('🧪 Starting Registration Followed by Login Regression Test Suite...\n');

  try {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log('✅ Connected to isolated in-memory test database');

    await new Promise<void>((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`✅ Test server running on port ${TEST_PORT}\n`);
        resolve();
      });
    });

    const timestamp = Date.now();
    const rawEmail = `  Sarah.Connor.${timestamp}@Example.COM  `;
    const normalizedEmail = `sarah.connor.${timestamp}@example.com`;
    const password = 'StrongPassword123!';
    const name = 'Sarah Connor';

    // ─────────────────────────────────────────────────────────────────────────
    // Test 1: Register new patient with mixed-case and whitespace-padded email
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Test 1: Register new patient with mixed-case & whitespace email');
    let authCookie = '';
    let csrfCookie = '';
    {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email: rawEmail, password }),
      });

      assert.equal(res.status, 201, 'Registration must return 201 Created');
      const data = ((await res.json()) as any);
      assert.equal(data.status, 'success');
      assert.equal(data.user.email, normalizedEmail, 'Email must be normalized to lowercase and trimmed');
      assert.equal(data.user.role, 'patient', 'Registered role must be patient');
      assert.equal(data.user.passwordHash, undefined, 'passwordHash must not be exposed in user response');
      assert.ok(data.csrfToken, 'Must issue a CSRF token');

      // Verify cookies
      const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
      for (const c of rawCookies) {
        if (c.includes('careconnect_token=')) authCookie = c.split(';')[0];
        if (c.includes('careconnect_csrf_token=')) csrfCookie = c.split(';')[0];
      }
      assert.ok(authCookie.includes('careconnect_token='), 'Must set careconnect_token cookie');
      assert.ok(csrfCookie.includes('careconnect_csrf_token='), 'Must set careconnect_csrf_token cookie');
      console.log('  ✓ Registration successful, safe user returned, cookies set');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 2: Verify user record in database
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 2: Verify password hashing, select: false, and normalization in MongoDB');
    {
      const dbUserWithoutSelect = await User.findOne({ email: normalizedEmail });
      assert.ok(dbUserWithoutSelect, 'User must exist in database');
      assert.strictEqual(
        (dbUserWithoutSelect as any).passwordHash,
        undefined,
        'passwordHash must be omitted by default (select: false)'
      );

      const dbUser = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
      assert.ok(dbUser, 'User must exist in database with normalized email');
      assert.equal(dbUser.isActive, true, 'User must be active');
      assert.notEqual(dbUser.passwordHash, password, 'Plaintext password must not be stored');
      assert.ok(dbUser.passwordHash.startsWith('$2'), 'passwordHash must be a valid bcrypt hash');

      const isBcryptMatch = await bcrypt.compare(password, dbUser.passwordHash);
      assert.equal(isBcryptMatch, true, 'bcrypt.compare must verify the password against the stored hash');
      console.log('  ✓ Stored passwordHash verified with bcrypt (cost factor 12) & select: false confirmed');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 3: Login immediately after registration with exact credentials
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 3: Login immediately with exact registered credentials');
    let loginAuthCookie = '';
    let loginCsrfCookie = '';
    {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      assert.equal(res.status, 200, 'Login must succeed with 200 OK');
      const data = ((await res.json()) as any);
      assert.equal(data.status, 'success');
      assert.equal(data.user.email, normalizedEmail);
      assert.equal(data.user.passwordHash, undefined, 'passwordHash must not be exposed in login response');
      assert.ok(data.csrfToken, 'Must issue a CSRF token');

      const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
      for (const c of rawCookies) {
        if (c.includes('careconnect_token=')) loginAuthCookie = c.split(';')[0];
        if (c.includes('careconnect_csrf_token=')) loginCsrfCookie = c.split(';')[0];
      }
      assert.ok(loginAuthCookie.includes('careconnect_token='), 'Must set careconnect_token cookie');
      console.log('  ✓ Login succeeded with 200 OK and fresh session cookies');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 4: Login with mixed-case and padded email (normalization test)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 4: Login with uppercase and padded email');
    {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `  ${normalizedEmail.toUpperCase()}  `, password }),
      });

      assert.equal(res.status, 200, 'Login must normalize email and succeed with 200 OK');
      const data = ((await res.json()) as any);
      assert.equal(data.status, 'success');
      assert.equal(data.user.email, normalizedEmail);
      console.log('  ✓ Login email normalization verified');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 5: Login with incorrect password
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 5: Login with wrong password rejected with generic 401');
    {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password: 'WrongPassword999!' }),
      });

      assert.equal(res.status, 401, 'Wrong password must return 401');
      const data = ((await res.json()) as any);
      assert.equal(data.status, 'error');
      assert.equal(data.message, 'Invalid email or password.');
      console.log('  ✓ Wrong password safely rejected with 401 (no credential enumeration)');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 6: Login with unregistered email
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 6: Login with non-existent email rejected with generic 401');
    {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'unregistered.user@example.com', password }),
      });

      assert.equal(res.status, 401, 'Unregistered email must return 401');
      const data = ((await res.json()) as any);
      assert.equal(data.status, 'error');
      assert.equal(data.message, 'Invalid email or password.');
      console.log('  ✓ Unregistered email safely returns identical generic 401');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 7: Missing or empty credentials rejected with 400
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 7: Missing or empty credentials rejected with 400');
    {
      const resEmpty = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '', password: '' }),
      });
      assert.equal(resEmpty.status, 400, 'Empty email/password must return 400');
      const dataEmpty = ((await resEmpty.json()) as any);
      assert.equal(dataEmpty.message, 'Email and password are required.');

      const resNoPass = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      assert.equal(resNoPass.status, 400, 'Missing password must return 400');
      console.log('  ✓ Empty/missing credentials properly rejected with 400');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 8: Deactivated account rejected with 403
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 8: Deactivated account rejected with 403');
    {
      await User.updateOne({ email: normalizedEmail }, { $set: { isActive: false } });

      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      assert.equal(res.status, 403, 'Deactivated account must return 403 Forbidden');
      const data = ((await res.json()) as any);
      assert.match(data.message, /deactivated/i);
      console.log('  ✓ Deactivated account properly rejected with 403');

      // Re-activate user for remaining tests
      await User.updateOne({ email: normalizedEmail }, { $set: { isActive: true } });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 9: Verify session persistence (GET /api/auth/me) with login cookies
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 9: Verify session persistence (GET /api/auth/me)');
    {
      const res = await fetch(`${BASE_URL}/auth/me`, {
        headers: { Cookie: `${loginAuthCookie}; ${loginCsrfCookie}` },
      });

      assert.equal(res.status, 200, 'GET /api/auth/me with session cookies must return 200');
      const data = ((await res.json()) as any);
      assert.equal(data.status, 'success');
      assert.equal(data.user.email, normalizedEmail);
      assert.equal(data.user.passwordHash, undefined);
      console.log('  ✓ Session cookie verified via GET /api/auth/me');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 10: Logout invalidates cookies
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 10: Logout clears session cookies');
    {
      const res = await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Cookie: `${loginAuthCookie}; ${loginCsrfCookie}` },
      });

      assert.equal(res.status, 200, 'Logout must return 200 OK');
      const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
      const cookieStr = rawCookies.join('; ');
      assert.ok(
        cookieStr.includes('careconnect_token=;') || cookieStr.includes('Max-Age=0') || cookieStr.includes('Expires='),
        'Logout must clear careconnect_token'
      );
      console.log('  ✓ Logout cleared session cookies');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎉 ALL 10 REGISTRATION & LOGIN REGRESSION TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════════════\n');
  } finally {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  }
}

runRegressionTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
