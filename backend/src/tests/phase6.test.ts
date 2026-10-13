/**
 * Automated Test Suite for Phase 6: Profile, Personal Health Profile,
 * Notification Preferences & Quiet Hours, and Personal Dashboard.
 *
 * Uses MongoMemoryServer for a fully isolated, safe in-memory test database.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { User } from '../models/User.js';
import { Medication } from '../models/Medication.js';
import { DoseRecord } from '../models/DoseRecord.js';
import { Appointment } from '../models/Appointment.js';
import { Doctor } from '../models/Doctor.js';
import authRoutes from '../routes/authRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import medicationRoutes from '../routes/medicationRoutes.js';
import doseRoutes from '../routes/doseRoutes.js';
import appointmentRoutes from '../routes/appointmentRoutes.js';
import doctorRoutes from '../routes/doctorRoutes.js';
import healthRoutes from '../routes/healthRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

const TEST_PORT = 5095;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/doses', doseRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use(errorHandler);

let mongoServer: MongoMemoryServer;
let server: http.Server;

/** Register a user and return session cookies + csrf token */
async function createTestUserSession(name: string, emailPrefix: string) {
  const email = `${emailPrefix}.${Date.now()}@test.careconnect.app`;
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: 'Password1234!' }),
  });
  assert.equal(res.status, 201, `Failed to register ${emailPrefix}: ${res.status}`);
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
    cookieHeader: `${authCookie}; ${csrfCookie}`,
    csrfToken,
    email,
  };
}

async function runTests() {
  console.log('🧪 Starting Phase 6 Profile, Health Profile & Dashboard Test Suite...\n');

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

    const sessionA = await createTestUserSession('Alice Health', 'alice6');
    const sessionB = await createTestUserSession('Bob Health', 'bob6');

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Profile retrieval — authenticated and unauthenticated
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Test 1: Profile retrieval — authenticated and unauthenticated access');
    {
      // Unauthenticated: must be rejected with 401
      const resGuest = await fetch(`${BASE_URL}/user/profile`);
      assert.equal(resGuest.status, 401, 'Unauthenticated GET /user/profile must return 401');

      // Authenticated: must return safe user object without passwordHash
      const resAuth = await fetch(`${BASE_URL}/user/profile`, {
        headers: { Cookie: sessionA.cookieHeader },
      });
      assert.equal(resAuth.status, 200, 'Authenticated GET /user/profile must return 200');
      const profile = (await resAuth.json()) as any;
      assert.equal(profile.name, 'Alice Health', 'Name must match');
      assert.equal(profile.email, sessionA.email, 'Email must match');
      assert.equal(profile.passwordHash, undefined, 'passwordHash must never be returned');
      assert.ok(profile.notificationPreferences, 'notificationPreferences must be included');
      console.log('  ✓ Unauthenticated 401, authenticated profile returned without passwordHash');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Profile update — permitted fields and validation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 2: Profile update — permitted fields and name validation');
    {
      // Valid update of name and phone
      const resUpdate = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({
          name: 'Alice Updated',
          phone: '+1-555-0100',
          bloodGroup: 'O+',
          dateOfBirth: '1990-05-15',
        }),
      });
      assert.equal(resUpdate.status, 200, 'Valid profile update must return 200');
      const updated = (await resUpdate.json()) as any;
      assert.equal(updated.name, 'Alice Updated', 'Name must be updated');
      assert.equal(updated.phone, '+1-555-0100', 'Phone must be updated');
      assert.equal(updated.bloodGroup, 'O+', 'Blood group must be updated');
      assert.equal(updated.passwordHash, undefined, 'passwordHash must never be returned on update');

      // Too-short name must be rejected
      const resShortName = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({ name: 'X' }),
      });
      assert.equal(resShortName.status, 400, 'Name shorter than 2 chars must be rejected with 400');

      console.log('  ✓ Valid update accepted; short name rejected with 400');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Rejection of protected-field modifications
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 3: Rejection of protected-field modifications (role, passwordHash, isActive)');
    {
      const protectedTests = [
        { body: { role: 'admin' }, field: 'role' },
        { body: { passwordHash: 'hacked' }, field: 'passwordHash' },
        { body: { isActive: false }, field: 'isActive' },
        { body: { _id: 'tampered' }, field: '_id' },
      ];

      for (const t of protectedTests) {
        const res = await fetch(`${BASE_URL}/user/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: sessionA.cookieHeader,
            'X-CSRF-Token': sessionA.csrfToken,
          },
          body: JSON.stringify(t.body),
        });
        assert.equal(res.status, 400, `Modifying '${t.field}' must return 400`);
        const data = (await res.json()) as any;
        assert.match(data.message, /protected/i, `Error message must mention 'protected'`);
      }

      // Verify role was NOT changed in the database
      const dbUser = await User.findOne({ email: sessionA.email });
      assert.equal(dbUser?.role, 'patient', 'Role must remain patient after tamper attempt');

      console.log('  ✓ All protected-field modifications correctly rejected with 400');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Cross-user profile isolation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 4: Cross-user profile isolation (Bob cannot update Alice\'s profile)');
    {
      // Bob attempts to PUT Alice's profile using Bob's session (server derives user from token)
      // This should update BOB's profile, not Alice's
      const resBobUpdate = await fetch(`${BASE_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionB.cookieHeader,
          'X-CSRF-Token': sessionB.csrfToken,
        },
        body: JSON.stringify({ name: 'Bob Updated' }),
      });
      assert.equal(resBobUpdate.status, 200, 'Bob updating his own profile must succeed');

      // Alice's profile must remain unchanged after Bob's update
      const resAliceProfile = await fetch(`${BASE_URL}/user/profile`, {
        headers: { Cookie: sessionA.cookieHeader },
      });
      const aliceData = (await resAliceProfile.json()) as any;
      assert.equal(aliceData.name, 'Alice Updated', "Alice's name must not be changed by Bob's session");
      console.log('  ✓ Session-based isolation: Bob\'s update affected only Bob\'s record');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Health profile — allergy CRUD
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 5: Health profile — allergy CRUD operations');
    {
      // GET health profile unauthenticated
      const resGuest = await fetch(`${BASE_URL}/user/health-profile`);
      assert.equal(resGuest.status, 401, 'Unauthenticated health profile GET must return 401');

      // Add first allergy
      const resAdd1 = await fetch(`${BASE_URL}/user/health-profile/allergies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({ allergy: 'Penicillin' }),
      });
      assert.equal(resAdd1.status, 200);
      const addData1 = (await resAdd1.json()) as any;
      assert.ok(addData1.allergies.includes('Penicillin'), 'Penicillin must be in allergies list');

      // Add second allergy
      await fetch(`${BASE_URL}/user/health-profile/allergies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({ allergy: 'Peanuts' }),
      });

      // Duplicate allergy should not double-add
      const resDup = await fetch(`${BASE_URL}/user/health-profile/allergies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({ allergy: 'PENICILLIN' }), // Case-insensitive duplicate
      });
      assert.equal(resDup.status, 200);
      const dupData = (await resDup.json()) as any;
      const penicillinCount = dupData.allergies.filter((a: string) => a.toLowerCase() === 'penicillin').length;
      assert.equal(penicillinCount, 1, 'Duplicate allergy must not be added (case-insensitive)');

      // Remove an allergy
      const resRemove = await fetch(`${BASE_URL}/user/health-profile/allergies/${encodeURIComponent('Penicillin')}`, {
        method: 'DELETE',
        headers: {
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
      });
      assert.equal(resRemove.status, 200);
      const removeData = (await resRemove.json()) as any;
      assert.ok(!removeData.allergies.includes('Penicillin'), 'Penicillin must be removed');
      assert.ok(removeData.allergies.includes('Peanuts'), 'Peanuts must still be present');

      // Empty allergy name must be rejected
      const resEmpty = await fetch(`${BASE_URL}/user/health-profile/allergies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({ allergy: '   ' }),
      });
      assert.equal(resEmpty.status, 400, 'Empty allergy name must be rejected with 400');

      console.log('  ✓ Allergy CRUD: add, duplicate prevention, removal, empty-name validation');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Health profile — conditions CRUD
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 6: Health profile — conditions CRUD operations');
    {
      // Add a condition
      const resAdd = await fetch(`${BASE_URL}/user/health-profile/conditions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({ condition: 'Hypertension' }),
      });
      assert.equal(resAdd.status, 200);
      const addData = (await resAdd.json()) as any;
      assert.ok(addData.chronicConditions.includes('Hypertension'));

      // GET health profile must return condition
      const resGet = await fetch(`${BASE_URL}/user/health-profile`, {
        headers: { Cookie: sessionA.cookieHeader },
      });
      assert.equal(resGet.status, 200);
      const hp = (await resGet.json()) as any;
      assert.ok(hp.data.chronicConditions.includes('Hypertension'), 'GET health profile must include conditions');
      assert.ok(hp.data.disclaimer, 'Health profile response must include disclaimer');

      // Remove the condition
      const resRemove = await fetch(`${BASE_URL}/user/health-profile/conditions/${encodeURIComponent('Hypertension')}`, {
        method: 'DELETE',
        headers: {
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
      });
      assert.equal(resRemove.status, 200);
      const removeData = (await resRemove.json()) as any;
      assert.ok(!removeData.chronicConditions.includes('Hypertension'), 'Hypertension must be removed');

      console.log('  ✓ Conditions CRUD: add, retrieve with disclaimer, removal');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Health profile — cross-user isolation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 7: Health profile — cross-user isolation');
    {
      // Add allergy to Alice
      await fetch(`${BASE_URL}/user/health-profile/allergies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({ allergy: 'Latex' }),
      });

      // Bob GET health profile must NOT contain Alice's allergy
      const resBobHp = await fetch(`${BASE_URL}/user/health-profile`, {
        headers: { Cookie: sessionB.cookieHeader },
      });
      assert.equal(resBobHp.status, 200);
      const bobHp = (await resBobHp.json()) as any;
      assert.ok(!bobHp.data.allergies.includes('Latex'), "Bob must not see Alice's allergies");

      // Alice's record is unaffected by Bob's request
      const resAliceHp = await fetch(`${BASE_URL}/user/health-profile`, {
        headers: { Cookie: sessionA.cookieHeader },
      });
      const aliceHp = (await resAliceHp.json()) as any;
      assert.ok(aliceHp.data.allergies.includes('Latex'), "Alice's own allergy must still be present");

      console.log("  ✓ Health profile data is strictly isolated by user session");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Bulk health profile update
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 8: Bulk health profile PUT update (blood group, allergies, conditions, emergency contact)');
    {
      const resBulk = await fetch(`${BASE_URL}/user/health-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionB.cookieHeader,
          'X-CSRF-Token': sessionB.csrfToken,
        },
        body: JSON.stringify({
          bloodGroup: 'AB+',
          allergies: ['Shellfish', 'Sulfonamides'],
          chronicConditions: ['Type 2 Diabetes', 'Hypothyroidism'],
          emergencyContact: {
            name: 'Carol Health',
            relationship: 'Spouse',
            phone: '+1-555-9999',
          },
        }),
      });
      assert.equal(resBulk.status, 200, 'Bulk health profile update must return 200');
      const result = (await resBulk.json()) as any;
      assert.equal(result.data.bloodGroup, 'AB+');
      assert.deepEqual(result.data.allergies, ['Shellfish', 'Sulfonamides']);
      assert.deepEqual(result.data.chronicConditions, ['Type 2 Diabetes', 'Hypothyroidism']);
      assert.equal(result.data.emergencyContact.name, 'Carol Health');
      assert.ok(result.data.disclaimer, 'Response must include disclaimer');

      console.log('  ✓ Bulk health profile updated: blood group, allergies, conditions, emergency contact');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Notification preferences — retrieval and update
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 9: Notification preferences — retrieval and update');
    {
      // GET unauthenticated must be 401
      const resGuest = await fetch(`${BASE_URL}/user/notifications`);
      assert.equal(resGuest.status, 401, 'Unauthenticated GET notifications must return 401');

      // GET authenticated returns defaults
      const resGet = await fetch(`${BASE_URL}/user/notifications`, {
        headers: { Cookie: sessionA.cookieHeader },
      });
      assert.equal(resGet.status, 200);
      const prefsData = (await resGet.json()) as any;
      assert.ok(typeof prefsData.data.medicationReminders === 'boolean');
      assert.ok(prefsData.data.deliveryNotice, 'Response must include delivery notice');

      // PUT to update valid preferences
      const resPut = await fetch(`${BASE_URL}/user/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({
          medicationReminders: false,
          appointmentAlerts: true,
          healthTips: true,
          emailUpdates: false,
        }),
      });
      assert.equal(resPut.status, 200, 'Valid preferences update must return 200');
      const updated = (await resPut.json()) as any;
      assert.equal(updated.data.medicationReminders, false);
      assert.equal(updated.data.appointmentAlerts, true);
      assert.equal(updated.data.healthTips, true);
      assert.equal(updated.data.emailUpdates, false);

      console.log('  ✓ Notification preferences retrieved with defaults and updated correctly');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Quiet hours — validation and midnight-crossing detection
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 10: Quiet hours — time format validation and midnight-crossing detection');
    {
      // Invalid time format must be rejected
      const resInvalidTime = await fetch(`${BASE_URL}/user/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({ quietHoursStart: '25:00' }), // Invalid hour
      });
      assert.equal(resInvalidTime.status, 400, 'Invalid time format must be rejected with 400');
      const errData = (await resInvalidTime.json()) as any;
      assert.match(errData.message, /HH:MM/i);

      // Invalid end time
      const resInvalidEnd = await fetch(`${BASE_URL}/user/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({ quietHoursEnd: '23:99' }), // Invalid minute
      });
      assert.equal(resInvalidEnd.status, 400, 'Invalid end time must be rejected with 400');

      // Valid midnight-crossing quiet hours (22:30 to 07:00)
      const resMidnight = await fetch(`${BASE_URL}/user/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({
          quietHoursEnabled: true,
          quietHoursStart: '22:30',
          quietHoursEnd: '07:00',
        }),
      });
      assert.equal(resMidnight.status, 200, 'Midnight-crossing quiet hours must be accepted');
      const midnightData = (await resMidnight.json()) as any;
      assert.equal(midnightData.data.quietHoursStart, '22:30');
      assert.equal(midnightData.data.quietHoursEnd, '07:00');
      assert.equal(midnightData.data.crossesMidnight, true, 'crossesMidnight must be true when start > end');

      // Same-day quiet hours (09:00 to 12:00) must not cross midnight
      const resSameDay = await fetch(`${BASE_URL}/user/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({
          quietHoursStart: '09:00',
          quietHoursEnd: '12:00',
        }),
      });
      assert.equal(resSameDay.status, 200);
      const sameDayData = (await resSameDay.json()) as any;
      assert.equal(sameDayData.data.crossesMidnight, false, 'crossesMidnight must be false for same-day range');

      console.log('  ✓ Time validation, midnight-crossing detected, same-day range correct');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 11. IANA timezone validation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 11: IANA timezone validation');
    {
      // Invalid timezone rejected
      const resInvalid = await fetch(`${BASE_URL}/user/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({ timeZone: 'NotAReal/Timezone' }),
      });
      assert.equal(resInvalid.status, 400, 'Invalid timezone must return 400');
      const tzErrData = (await resInvalid.json()) as any;
      assert.match(tzErrData.message, /IANA/i);

      // Valid IANA timezone accepted
      const resValid = await fetch(`${BASE_URL}/user/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({ timeZone: 'Asia/Kolkata' }),
      });
      assert.equal(resValid.status, 200, 'Valid IANA timezone must return 200');
      const tzData = (await resValid.json()) as any;
      assert.equal(tzData.data.timeZone, 'Asia/Kolkata', 'Saved timezone must be Asia/Kolkata');

      // Common timezones must also be accepted
      for (const tz of ['UTC', 'America/New_York', 'Europe/London']) {
        const r = await fetch(`${BASE_URL}/user/notifications`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: sessionA.cookieHeader,
            'X-CSRF-Token': sessionA.csrfToken,
          },
          body: JSON.stringify({ timeZone: tz }),
        });
        assert.equal(r.status, 200, `Timezone '${tz}' must be accepted`);
      }

      console.log('  ✓ Invalid IANA timezone rejected; common timezones accepted and persisted');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 12. CSRF protection on mutation endpoints
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 12: CSRF protection on all profile mutation endpoints');
    {
      const mutationEndpoints = [
        { url: `${BASE_URL}/user/profile`, method: 'PUT', body: JSON.stringify({ name: 'Csrf Test' }) },
        { url: `${BASE_URL}/user/health-profile`, method: 'PUT', body: JSON.stringify({ bloodGroup: 'B+' }) },
        { url: `${BASE_URL}/user/health-profile/allergies`, method: 'POST', body: JSON.stringify({ allergy: 'TestCsrf' }) },
        { url: `${BASE_URL}/user/notifications`, method: 'PUT', body: JSON.stringify({ healthTips: false }) },
      ];

      for (const endpoint of mutationEndpoints) {
        const res = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
            Cookie: sessionA.cookieHeader,
            // Intentionally omit X-CSRF-Token header
          },
          body: endpoint.body,
        });
        assert.equal(res.status, 403, `${endpoint.method} ${endpoint.url} without CSRF token must return 403`);
      }
      console.log('  ✓ All profile mutation endpoints enforce CSRF validation (403 without token)');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 13. Dashboard API data: today's doses query
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 13: Dashboard API — today\'s doses endpoint');
    {
      // Unauthenticated
      const resGuest = await fetch(`${BASE_URL}/doses/today`);
      assert.equal(resGuest.status, 401, 'Unauthenticated /doses/today must return 401');

      // Authenticated with no medications: empty array
      const resEmpty = await fetch(`${BASE_URL}/doses/today`, {
        headers: { Cookie: sessionB.cookieHeader },
      });
      assert.equal(resEmpty.status, 200, '/doses/today must return 200 when no doses exist');
      const emptyDoses = (await resEmpty.json()) as any;
      assert.ok(Array.isArray(emptyDoses), 'Response must be an array');
      assert.equal(emptyDoses.length, 0, 'No doses scheduled for new user');

      console.log("  ✓ Unauthenticated 401; empty array for user without doses");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 14. Dashboard API data: upcoming appointments endpoint
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 14: Dashboard API — upcoming appointments endpoint');
    {
      // Unauthenticated
      const resGuest = await fetch(`${BASE_URL}/appointments?status=upcoming`);
      assert.equal(resGuest.status, 401, 'Unauthenticated appointments must return 401');

      // Authenticated: empty when no appointments booked
      const resEmpty = await fetch(`${BASE_URL}/appointments?status=upcoming`, {
        headers: { Cookie: sessionA.cookieHeader },
      });
      assert.equal(resEmpty.status, 200);
      const emptyAppts = (await resEmpty.json()) as any;
      assert.ok(Array.isArray(emptyAppts), 'Response must be an array');
      assert.equal(emptyAppts.length, 0, 'No appointments for new user');

      console.log("  ✓ Unauthenticated 401; empty upcoming appointments for new user");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 15. Dashboard: cancelled appointments excluded from upcoming
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 15: Dashboard — cancelled appointments excluded from upcoming list');
    {
      // Seed a test doctor directly in MongoDB
      const testSlug = `dr-phase6-test-${Date.now()}`;
      const doctor = await Doctor.create({
        slug: testSlug,
        name: 'Dr. Phase6 Test',
        specialty: 'General Physician',
        qualifications: 'MBBS',
        experienceYears: 5,
        hospital: 'Test Hospital',
        rating: 4.5,
        reviewCount: 10,
        consultationFee: 100,
        consultationDurationMinutes: 30,
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        workingHours: { start: '09:00', end: '17:00' },
        avatarInitials: 'P6',
        avatarColor: '#2563EB',
        languages: ['English'],
        isActive: true,
      });

      // Create a future date (next Monday)
      const now = new Date();
      const daysToNextMonday = (8 - now.getUTCDay()) % 7 || 7;
      const futureDate = new Date(now);
      futureDate.setUTCDate(futureDate.getUTCDate() + daysToNextMonday);
      futureDate.setUTCHours(10, 0, 0, 0);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      // Directly create a cancelled appointment in DB
      const patientUser = await User.findOne({ email: sessionA.email });
      await Appointment.create({
        patientId: patientUser!._id,
        doctorId: doctor._id,
        doctorName: doctor.name,
        doctorSpecialty: doctor.specialty,
        startAt: futureDate,
        endAt: new Date(futureDate.getTime() + 30 * 60 * 1000),
        timezone: 'UTC',
        date: futureDateStr,
        timeSlot: '10:00',
        type: 'in-person',
        status: 'cancelled', // Explicitly cancelled
      });

      // API upcoming filter must exclude cancelled appointments
      const resUpcoming = await fetch(`${BASE_URL}/appointments?status=upcoming`, {
        headers: { Cookie: sessionA.cookieHeader },
      });
      const upcomingAppts = (await resUpcoming.json()) as any;
      const cancelledVisible = upcomingAppts.some((a: any) => a.status === 'cancelled');
      assert.equal(cancelledVisible, false, 'Cancelled appointments must not appear in upcoming list');
      console.log('  ✓ Cancelled appointments correctly excluded from upcoming results');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 16. Regression — Phases 1-5 endpoints remain functional
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 16: Regression — Phases 1-5 endpoints remain functional');
    {
      // Health check
      const resHealth = await fetch(`${BASE_URL}/health`);
      assert.equal(resHealth.status, 200);
      const health = (await resHealth.json()) as any;
      assert.equal(health.status, 'ok');

      // Auth /me endpoint
      const resMe = await fetch(`${BASE_URL}/auth/me`, {
        headers: { Cookie: sessionA.cookieHeader },
      });
      assert.equal(resMe.status, 200, 'GET /api/auth/me must still return 200');
      const me = (await resMe.json()) as any;
      assert.ok(me.user, 'Response must include user');
      assert.equal(me.user.passwordHash, undefined, 'passwordHash must not be in response');

      // Medications endpoint still enforces auth
      const resMeds = await fetch(`${BASE_URL}/medications`);
      assert.equal(resMeds.status, 401, '/api/medications must still require authentication');

      // Appointments endpoint still enforces auth
      const resAppts = await fetch(`${BASE_URL}/appointments`);
      assert.equal(resAppts.status, 401, '/api/appointments must still require authentication');

      // Doses today endpoint still enforces auth
      const resDoses = await fetch(`${BASE_URL}/doses/today`);
      assert.equal(resDoses.status, 401, '/api/doses/today must still require authentication');

      console.log('  ✓ All Phase 1-5 endpoints remain functional and enforce auth correctly');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎉 ALL 16 PHASE 6 PROFILE & DASHBOARD TESTS PASSED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════════════\n');
  } finally {
    if (server!) {
      server.close();
    }
    await mongoose.disconnect();
    if (mongoServer!) {
      await mongoServer.stop();
    }
  }
}

runTests().catch((err) => {
  console.error('❌ Phase 6 test suite failed:', err);
  process.exit(1);
});
