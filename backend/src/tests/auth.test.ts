/**
 * Comprehensive Automated Test Suite for Phase 3: Secure User Authentication
 *
 * Uses MongoMemoryServer for safe, isolated in-memory test database execution
 * without altering production data or requiring Atlas network whitelisting.
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
import { Article } from '../models/Article.js';
import authRoutes from '../routes/authRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import articleRoutes from '../routes/articleRoutes.js';
import healthRoutes from '../routes/healthRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

const TEST_PORT = 5098;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/articles', articleRoutes);
app.use(errorHandler);

let mongoServer: MongoMemoryServer;
let server: http.Server;

async function runTests() {
  console.log('🧪 Starting Phase 3 Secure Authentication Test Suite...\n');

  try {
    // Start isolated in-memory MongoDB server
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

    const testTimestamp = Date.now();
    const testEmail = `test.user.${testTimestamp}@example.com`;
    const testPassword = 'SecurePassword123!';
    const testName = 'Test Patient';

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Validation tests for registration
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Test 1: Reject registration with missing or invalid fields');
    {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'A', email: 'invalid-email', password: 'short' }),
      });
      assert.equal(res.status, 400, 'Expected 400 Bad Request');
      const data = ((await res.json()) as any);
      assert.equal(data.status, 'error');
      console.log('  ✓ Rejected invalid input with 400');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Reject role escalation in public registration
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 2: Reject role escalation during public registration');
    {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Hacker User',
          email: `hacker.${testTimestamp}@example.com`,
          password: 'SecurePassword123!',
          role: 'admin',
        }),
      });
      assert.equal(res.status, 400, 'Expected 400 Bad Request on role tampering');
      const data = ((await res.json()) as any);
      assert.match(data.message, /privileged roles/i);
      console.log('  ✓ Rejected role tampering with 400');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Successful registration
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 3: Successful registration and safe user payload');
    let authCookie = '';
    let csrfCookie = '';
    let csrfTokenValue = '';
    {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: testName,
          email: testEmail.toUpperCase(), // Test email normalization
          password: testPassword,
        }),
      });
      assert.equal(res.status, 201, 'Expected 201 Created');
      const data = ((await res.json()) as any);
      assert.equal(data.status, 'success');
      assert.equal(data.user.email, testEmail.toLowerCase(), 'Email should be normalized');
      assert.equal(data.user.role, 'patient', 'New users must have patient role');
      assert.equal(data.user.passwordHash, undefined, 'Password hash must never be returned');
      assert.ok(data.csrfToken, 'Should return csrfToken');
      csrfTokenValue = data.csrfToken;

      const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
      const cookieStr = rawCookies.join('; ');
      assert.match(cookieStr, /careconnect_token=/, 'Should set careconnect_token cookie');
      assert.match(cookieStr, /HttpOnly/i, 'Token cookie must be HttpOnly');

      // Extract cookies for subsequent requests
      for (const c of rawCookies) {
        if (c.includes('careconnect_token=')) {
          authCookie = c.split(';')[0];
        }
        if (c.includes('careconnect_csrf_token=')) {
          csrfCookie = c.split(';')[0];
        }
      }
      console.log('  ✓ User registered, email normalized, passwordHash omitted, HttpOnly cookie set');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Verify password hashing in database
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 4: Verify password is securely hashed in database');
    {
      const userInDb = await User.findOne({ email: testEmail.toLowerCase() });
      assert.ok(userInDb, 'User must exist in database');
      assert.notEqual(userInDb.passwordHash, testPassword, 'Raw password must never be stored');
      assert.ok(userInDb.passwordHash.startsWith('$2'), 'Must be a bcrypt hash');
      const isMatch = await bcrypt.compare(testPassword, userInDb.passwordHash);
      assert.equal(isMatch, true, 'bcrypt hash must verify candidate password');
      console.log('  ✓ Verified bcrypt hash in database');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Reject duplicate email registration
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 5: Reject duplicate email registration');
    {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate User',
          email: testEmail,
          password: 'AnotherPassword123!',
        }),
      });
      assert.equal(res.status, 409, 'Expected 409 Conflict');
      const data = ((await res.json()) as any);
      assert.match(data.message, /already exists/i);
      console.log('  ✓ Rejected duplicate email with 409 Conflict');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Test GET /api/auth/me with active session
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 6: GET /api/auth/me returns authenticated profile');
    {
      const res = await fetch(`${BASE_URL}/auth/me`, {
        headers: { Cookie: `${authCookie}; ${csrfCookie}` },
      });
      assert.equal(res.status, 200, 'Expected 200 OK');
      const data = ((await res.json()) as any);
      assert.equal(data.user.email, testEmail.toLowerCase());
      assert.equal(data.user.passwordHash, undefined);
      console.log('  ✓ GET /api/auth/me returned user profile');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Successful login
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 7: Successful login with correct credentials');
    {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });
      assert.equal(res.status, 200, 'Expected 200 OK');
      const data = ((await res.json()) as any);
      assert.equal(data.status, 'success');
      assert.equal(data.user.email, testEmail.toLowerCase());
      assert.equal(data.user.passwordHash, undefined);
      console.log('  ✓ Successfully logged in');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Invalid login credentials (generic message, no email enumeration)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 8: Invalid login returns generic 401 error');
    {
      // Wrong password
      const resWrongPw = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: 'WrongPassword999!' }),
      });
      assert.equal(resWrongPw.status, 401);
      const dataPw = ((await resWrongPw.json()) as any);
      assert.equal(dataPw.message, 'Invalid email or password.');

      // Non-existent email
      const resNoUser = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@example.com', password: 'SomePassword123!' }),
      });
      assert.equal(resNoUser.status, 401);
      const dataNoUser = ((await resNoUser.json()) as any);
      assert.equal(dataNoUser.message, 'Invalid email or password.');
      console.log('  ✓ Generic 401 returned for both wrong password and missing email');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Inactive account rejection
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 9: Inactive account login rejection');
    {
      const inactiveEmail = `inactive.${testTimestamp}@example.com`;
      const hash = await bcrypt.hash(testPassword, 10);
      await User.create({
        name: 'Inactive User',
        email: inactiveEmail,
        passwordHash: hash,
        role: 'patient',
        isActive: false,
      });

      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inactiveEmail, password: testPassword }),
      });
      assert.equal(res.status, 403, 'Expected 403 Forbidden for deactivated account');
      const data = ((await res.json()) as any);
      assert.match(data.message, /deactivated/i);
      console.log('  ✓ Inactive account rejected with 403');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Protected user profile endpoints and CSRF protection
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 10: Protected profile access and CSRF protection');
    {
      // Unauthenticated request to /api/user/profile
      const unauthRes = await fetch(`${BASE_URL}/user/profile`);
      assert.equal(unauthRes.status, 401, 'Expected 401 without cookie');

      // Authenticated PUT with missing CSRF header
      const noCsrfRes = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${authCookie}; ${csrfCookie}`,
        },
        body: JSON.stringify({ phone: '+91 9988776655' }),
      });
      assert.equal(noCsrfRes.status, 403, 'Expected 403 for missing CSRF header');

      // Authenticated PUT with valid CSRF header
      const csrfToken = csrfCookie.replace('careconnect_csrf_token=', '');
      const validPutRes = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${authCookie}; ${csrfCookie}`,
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          phone: '+91 9988776655',
          bloodGroup: 'B+',
          role: 'admin', // Tampering attempt: should be ignored
        }),
      });
      assert.equal(validPutRes.status, 200, 'Expected 200 for valid update');
      const updatedData = ((await validPutRes.json()) as any);
      assert.equal(updatedData.phone, '+91 9988776655');
      assert.equal(updatedData.bloodGroup, 'B+');
      assert.equal(updatedData.role, 'patient', 'Role must remain patient');
      console.log('  ✓ Protected profile verified, CSRF validated, and role tampering blocked');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 11. User-specific article bookmarking
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 11: Associate bookmarks with authenticated user');
    {
      const articleSlug = 'healthy-heart-habits';
      let article = await Article.findOne({ slug: articleSlug });
      if (!article) {
        article = await Article.create({
          slug: articleSlug,
          title: 'Healthy Heart Habits',
          category: 'Cardiology',
          summary: 'Simple habits for heart health',
          content: 'Eat well and exercise.',
          tags: ['heart', 'wellness'],
          readingTimeMinutes: 5,
          publishedAt: new Date().toISOString(),
          bookmarked: false,
        });
      }

      const csrfToken = csrfCookie.replace('careconnect_csrf_token=', '');

      // Toggle bookmark ON
      const bmRes1 = await fetch(`${BASE_URL}/articles/${articleSlug}/bookmark`, {
        method: 'POST',
        headers: {
          Cookie: `${authCookie}; ${csrfCookie}`,
          'X-CSRF-Token': csrfToken,
        },
      });
      assert.equal(bmRes1.status, 200);
      const bmData1 = ((await bmRes1.json()) as any);
      assert.equal(bmData1.bookmarked, true);

      // Verify user document has bookmarked article
      const userWithBm = await User.findOne({ email: testEmail.toLowerCase() });
      assert.ok(userWithBm?.bookmarkedArticles.includes(articleSlug));

      // Toggle bookmark OFF
      const bmRes2 = await fetch(`${BASE_URL}/articles/${articleSlug}/bookmark`, {
        method: 'POST',
        headers: {
          Cookie: `${authCookie}; ${csrfCookie}`,
          'X-CSRF-Token': csrfToken,
        },
      });
      assert.equal(bmRes2.status, 200);
      const bmData2 = ((await bmRes2.json()) as any);
      assert.equal(bmData2.bookmarked, false);
      console.log('  ✓ User bookmark toggle verified and isolated to authenticated user');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 12. Logout endpoint
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 12: Logout clears cookies');
    {
      const res = await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: { Cookie: `${authCookie}; ${csrfCookie}` },
      });
      assert.equal(res.status, 200);
      const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
      const cookieStr = rawCookies.join('; ');
      assert.match(cookieStr, /careconnect_token=;/);
      console.log('  ✓ Logout successfully cleared session cookies');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 13. Health endpoints remain intact
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 13: Existing health endpoints remain functional');
    {
      const resHealth = await fetch(`${BASE_URL}/health`);
      assert.equal(resHealth.status, 200);
      const healthData = ((await resHealth.json()) as any);
      assert.equal(healthData.service, 'CareConnect Backend API');

      const resDb = await fetch(`${BASE_URL}/health/db`);
      assert.equal(resDb.status, 200);
      const dbData = ((await resDb.json()) as any);
      assert.equal(dbData.database, 'connected');
      console.log('  ✓ GET /api/health and GET /api/health/db respond with 200');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎉 ALL 13 AUTHENTICATION TESTS PASSED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════════════\n');
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
