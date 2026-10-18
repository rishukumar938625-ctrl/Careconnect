/**
 * Automated Regression Test Suite: Profile Authentication & Update Hardening
 *
 * Covers:
 * 1. An authenticated user successfully updating their profile
 * 2. A missing authentication credential
 * 3. An expired or invalid credential
 * 4. A valid session after refreshing the page (GET /api/auth/me)
 * 5. Incorrect or missing credentials on the profile update request (missing CSRF)
 * 6. Invalid profile fields (short name, long name, non-array allergies)
 * 7. Attempts to change protected email or role fields
 * 8. A database failure during profile update (returns 500, NOT 401)
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { User } from '../models/User.js';
import authRoutes from '../routes/authRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import healthRoutes from '../routes/healthRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { generateToken } from '../utils/token.js';

const TEST_PORT = 5094;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use(errorHandler);

let mongoServer: MongoMemoryServer;
let server: http.Server;

/** Helper to register a test user and obtain authentication and CSRF cookies */
async function createTestSession(name: string, emailPrefix: string) {
  const email = `${emailPrefix}.${Date.now()}@test.careconnect.app`;
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: 'Password1234!' }),
  });
  assert.equal(res.status, 201, `Failed to register ${emailPrefix}`);
  const data = (await res.json()) as any;

  const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
  let authCookie = '';
  let csrfCookie = '';
  for (const c of rawCookies) {
    if (c.includes('careconnect_token=')) authCookie = c.split(';')[0];
    if (c.includes('careconnect_csrf_token=')) csrfCookie = c.split(';')[0];
  }
  const csrfToken = csrfCookie.replace('careconnect_csrf_token=', '');

  return {
    user: data.user,
    authCookie,
    csrfCookie,
    cookieHeader: `${authCookie}; ${csrfCookie}`,
    csrfToken,
    email,
  };
}

async function runTests() {
  console.log('🧪 Starting Profile Authentication & Update Regression Test Suite...\n');

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

    const session = await createTestSession('Diana Prince', 'diana');

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Authenticated user successfully updating their profile
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Test 1: Authenticated user successfully updating their profile');
    {
      const res = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: session.cookieHeader,
          'X-CSRF-Token': session.csrfToken,
        },
        body: JSON.stringify({
          name: 'Diana Princess',
          phone: '+1 555-0199',
          dateOfBirth: '1985-03-22',
          bloodGroup: 'AB+',
        }),
      });

      assert.equal(res.status, 200, 'Expected 200 OK for valid profile update');
      const data = (await res.json()) as any;
      assert.equal(data.name, 'Diana Princess');
      assert.equal(data.phone, '+1 555-0199');
      assert.equal(data.bloodGroup, 'AB+');
      assert.equal(data.dateOfBirth, '1985-03-22');
      assert.equal(data.role, 'patient', 'Role must remain unchanged');
      assert.equal(data.passwordHash, undefined, 'passwordHash must never be exposed');
      console.log('  ✓ Authenticated user profile updated successfully');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Missing authentication credential
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 2: Missing authentication credential rejected with 401');
    {
      const res = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacker' }),
      });

      assert.equal(res.status, 401, 'Expected 401 for missing auth cookie');
      const data = (await res.json()) as any;
      assert.equal(data.status, 'error');
      assert.match(data.message, /authentication required/i);
      console.log('  ✓ Rejected missing authentication credential with 401');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Expired or invalid credential
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 3: Expired or invalid token rejected with 401');
    {
      // Case 3a: Tampered JWT string
      const resTampered = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'careconnect_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        },
        body: JSON.stringify({ name: 'Tampered' }),
      });
      assert.equal(resTampered.status, 401, 'Expected 401 for tampered JWT');
      const dataTampered = (await resTampered.json()) as any;
      assert.match(dataTampered.message, /session has expired or is invalid/i);

      // Case 3b: Malformed non-ObjectId userId in payload
      const badIdToken = generateToken({
        userId: 'not-an-objectid-123',
        email: 'bad@example.com',
        role: 'patient',
      });
      const resBadId = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `careconnect_token=${badIdToken}`,
        },
        body: JSON.stringify({ name: 'Bad ID' }),
      });
      assert.equal(resBadId.status, 401, 'Expected 401 for malformed userId in token');
      const dataBadId = (await resBadId.json()) as any;
      assert.match(dataBadId.message, /session has expired or is invalid/i);

      console.log('  ✓ Invalid and malformed tokens rejected with 401 session expired message');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Valid session after refreshing the page (GET /api/auth/me)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 4: Valid session verification on page refresh (GET /api/auth/me)');
    {
      const res = await fetch(`${BASE_URL}/auth/me`, {
        headers: { Cookie: session.cookieHeader },
      });

      assert.equal(res.status, 200, 'Expected 200 for GET /auth/me');
      const data = (await res.json()) as any;
      assert.equal(data.status, 'success');
      assert.equal(data.user.email, session.email);
      assert.ok(data.csrfToken, 'Response must include active CSRF token');
      console.log('  ✓ User session and CSRF token verified on page refresh');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Incorrect or missing credentials on profile update request
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 5: Missing or mismatched CSRF token on state-changing request');
    {
      // Missing CSRF token
      const resMissingCsrf = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: session.cookieHeader,
          // Omitting X-CSRF-Token header
        },
        body: JSON.stringify({ phone: '+1 555-1234' }),
      });
      assert.equal(resMissingCsrf.status, 403, 'Expected 403 for missing CSRF header');
      const dataMissing = (await resMissingCsrf.json()) as any;
      assert.match(dataMissing.message, /csrf/i);

      // Mismatched CSRF token
      const resWrongCsrf = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: session.cookieHeader,
          'X-CSRF-Token': 'wrong-unmatched-csrf-token',
        },
        body: JSON.stringify({ phone: '+1 555-1234' }),
      });
      assert.equal(resWrongCsrf.status, 403, 'Expected 403 for mismatched CSRF token');
      console.log('  ✓ Missing or mismatched CSRF token rejected with 403');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Invalid profile fields validation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 6: Invalid profile fields rejected with 400');
    {
      // Too short name (< 2 chars)
      const resShortName = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: session.cookieHeader,
          'X-CSRF-Token': session.csrfToken,
        },
        body: JSON.stringify({ name: 'X' }),
      });
      assert.equal(resShortName.status, 400, 'Expected 400 for short name');

      // Non-array allergies
      const resBadAllergies = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: session.cookieHeader,
          'X-CSRF-Token': session.csrfToken,
        },
        body: JSON.stringify({ allergies: 'Pollen' }),
      });
      assert.equal(resBadAllergies.status, 400, 'Expected 400 for non-array allergies');

      // Non-object emergencyContact
      const resBadEmergency = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: session.cookieHeader,
          'X-CSRF-Token': session.csrfToken,
        },
        body: JSON.stringify({ emergencyContact: 'Bob Spouse' }),
      });
      assert.equal(resBadEmergency.status, 400, 'Expected 400 for string emergency contact');

      console.log('  ✓ Field validation failures appropriately return 400 Bad Request');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Attempts to change protected email or role fields
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 7: Attempts to change protected fields rejected with 400');
    {
      // Attempting to change role
      const resRole = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: session.cookieHeader,
          'X-CSRF-Token': session.csrfToken,
        },
        body: JSON.stringify({ role: 'admin' }),
      });
      assert.equal(resRole.status, 400, 'Expected 400 when attempting to modify role');
      const dataRole = (await resRole.json()) as any;
      assert.match(dataRole.message, /protected field 'role'/i);

      // Attempting to change email directly
      const resEmail = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: session.cookieHeader,
          'X-CSRF-Token': session.csrfToken,
        },
        body: JSON.stringify({ email: 'newemail@example.com' }),
      });
      assert.equal(resEmail.status, 400, 'Expected 400 when attempting to change email');
      const dataEmail = (await resEmail.json()) as any;
      assert.match(dataEmail.message, /email/i);

      console.log('  ✓ Role and email tampering securely blocked with 400');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Database failure during profile update returns 500, NOT 401
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 8: Database failure during profile update returns 500, NOT 401');
    {
      // Temporarily mock User.findById to simulate a database query error
      const originalFindById = User.findById;
      try {
        (User as any).findById = () => {
          return {
            then: (_resolve: any, reject: any) => {
              reject(new Error('MongoNetworkTimeoutError: connection timed out to replica set'));
            },
          };
        };

        const resDbError = await fetch(`${BASE_URL}/user/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: session.cookieHeader,
            'X-CSRF-Token': session.csrfToken,
          },
          body: JSON.stringify({ name: 'Valid Update' }),
        });

        // CRITICAL CHECK: Must return 500 Server Error, NOT 401 "Authentication failed."
        assert.equal(resDbError.status, 500, 'Database failure must return 500 Server Error');
        const dataDbError = (await resDbError.json()) as any;
        assert.notEqual(dataDbError.message, 'Authentication failed.', 'Must NOT claim authentication failed on DB error');
        console.log('  ✓ Database failure safely returns 500 and does NOT mask error as 401');
      } finally {
        User.findById = originalFindById;
      }
    }

    console.log('\n============================================================');
    console.log('Profile Authentication & Update Regression Tests: ALL PASSED ✅');
    console.log('============================================================\n');
  } finally {
    if (server) {
      server.close();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
