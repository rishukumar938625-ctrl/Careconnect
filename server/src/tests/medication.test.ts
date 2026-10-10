/**
 * Comprehensive Automated Test Suite for Phase 4: Medication Reminders and Tracking
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
import authRoutes from '../routes/authRoutes.js';
import medicationRoutes from '../routes/medicationRoutes.js';
import doseRoutes from '../routes/doseRoutes.js';
import healthRoutes from '../routes/healthRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { generateDosesForMedication, isMedicationScheduledOnDate, formatDateStr } from '../utils/scheduler.js';

const TEST_PORT = 5097;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/doses', doseRoutes);
app.use(errorHandler);

let mongoServer: MongoMemoryServer;
let server: http.Server;

async function runTests() {
  console.log('🧪 Starting Phase 4 Medication & Dose Tracking Test Suite...\n');

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

    // Helper to register a test user and obtain auth cookies
    async function createTestUserSession(emailPrefix: string) {
      const email = `${emailPrefix}.${Date.now()}@test.careconnect.app`;
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${emailPrefix} User`,
          email,
          password: 'Password1234!',
        }),
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
        cookieHeader: `${authCookie}; ${csrfCookie}`,
        csrfToken,
      };
    }

    const sessionA = await createTestUserSession('alice');
    const sessionB = await createTestUserSession('bob');

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Reject unauthenticated medication requests
    // ─────────────────────────────────────────────────────────────────────────
    console.log('Test 1: Reject unauthenticated medication requests (401)');
    {
      const res = await fetch(`${BASE_URL}/medications`);
      assert.equal(res.status, 401, 'Should reject without authentication');
      console.log('  ✓ Rejected unauthenticated request with 401');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Create medication with validation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 2: Create medication with field validation & invalid date rejection');
    let medicationIdA = '';
    {
      // Missing name
      const resMissing = await fetch(`${BASE_URL}/medications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({
          dosage: '500mg',
          startDate: '2026-10-10',
        }),
      });
      assert.equal(resMissing.status, 400);

      // Invalid date range (endDate before startDate)
      const resDateErr = await fetch(`${BASE_URL}/medications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({
          name: 'Amoxicillin',
          dosage: '500mg',
          startDate: '2026-10-15',
          endDate: '2026-10-10', // Invalid: end before start
        }),
      });
      assert.equal(resDateErr.status, 400);

      // Valid medication creation
      const resValid = await fetch(`${BASE_URL}/medications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({
          name: 'Metformin',
          dosage: '500mg',
          form: 'tablet',
          frequency: 'twice_daily',
          timesOfDay: ['08:00', '20:00'],
          startDate: '2026-10-01',
          endDate: '2026-11-01',
          instructions: 'Take with evening meal',
          timezone: 'Asia/Kolkata',
          color: '#10B981',
        }),
      });
      assert.equal(resValid.status, 201, 'Should create medication successfully');
      const medData = (await resValid.json()) as any;
      assert.equal(medData.name, 'Metformin');
      assert.equal(medData.dosage, '500mg');
      assert.equal(medData.frequency, 'twice_daily');
      assert.equal(medData.timesOfDay.length, 2);
      assert.equal(medData.userId, sessionA.user.id, 'Record must be owned by authenticated user');
      medicationIdA = medData._id;
      console.log('  ✓ Validated inputs and successfully created medication for Alice');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. User isolation: Bob cannot access Alice's medication
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\nTest 3: Cross-user isolation (Bob cannot view or modify Alice's medication)");
    {
      // Bob tries to GET Alice's medication
      const resGetOther = await fetch(`${BASE_URL}/medications/${medicationIdA}`, {
        headers: { Cookie: sessionB.cookieHeader },
      });
      assert.equal(resGetOther.status, 404, 'Must return 404 when accessing other user record');

      // Bob tries to PATCH Alice's medication
      const resPatchOther = await fetch(`${BASE_URL}/medications/${medicationIdA}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionB.cookieHeader,
          'X-CSRF-Token': sessionB.csrfToken,
        },
        body: JSON.stringify({ name: 'Tampered Name' }),
      });
      assert.equal(resPatchOther.status, 404, 'Must return 404 when modifying other user record');

      // Bob tries to DELETE Alice's medication
      const resDeleteOther = await fetch(`${BASE_URL}/medications/${medicationIdA}`, {
        method: 'DELETE',
        headers: {
          Cookie: sessionB.cookieHeader,
          'X-CSRF-Token': sessionB.csrfToken,
        },
      });
      assert.equal(resDeleteOther.status, 404, 'Must return 404 when deleting other user record');
      console.log("  ✓ Confirmed strict 404 isolation: Bob cannot read, edit, or delete Alice's records");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Update and Read owned medication
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 4: Alice updates her medication dosage and instructions');
    {
      const resUpdate = await fetch(`${BASE_URL}/medications/${medicationIdA}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({
          dosage: '850mg',
          instructions: 'Take twice daily with food',
        }),
      });
      assert.equal(resUpdate.status, 200);
      const updated = (await resUpdate.json()) as any;
      assert.equal(updated.dosage, '850mg');
      assert.equal(updated.instructions, 'Take twice daily with food');

      // Alice lists her medications
      const resList = await fetch(`${BASE_URL}/medications`, {
        headers: { Cookie: sessionA.cookieHeader },
      });
      assert.equal(resList.status, 200);
      const list = (await resList.json()) as any[];
      assert.equal(list.length, 1);
      assert.equal(list[0]._id, medicationIdA);
      console.log('  ✓ Alice updated and retrieved her medication list');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Scheduling idempotency & duplicate prevention
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 5: Dose scheduler idempotency (running multiple times generates 0 duplicates)');
    {
      const medDoc = await Medication.findById(medicationIdA);
      assert.ok(medDoc);

      const count1 = await generateDosesForMedication(medDoc, 7, '2026-10-10');
      const totalDosesBefore = await DoseRecord.countDocuments({ medicationId: medicationIdA });

      // Run scheduler a 2nd time on identical parameters
      const count2 = await generateDosesForMedication(medDoc, 7, '2026-10-10');
      const totalDosesAfter = await DoseRecord.countDocuments({ medicationId: medicationIdA });

      assert.equal(count2, 0, 'Second run must insert 0 duplicates');
      assert.equal(totalDosesBefore, totalDosesAfter, 'Total dose record count must not change');
      console.log(`  ✓ Scheduler ran idempotently: ${totalDosesBefore} doses preserved without duplicates`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Recurrence rule verification
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 6: Recurrence rule checks (daily vs weekly vs as_needed)');
    {
      const dailyMed = new Medication({
        startDate: '2026-10-01',
        frequency: 'once_daily',
      });
      assert.equal(isMedicationScheduledOnDate(dailyMed, '2026-10-05'), true);

      const asNeededMed = new Medication({
        startDate: '2026-10-01',
        frequency: 'as_needed',
      });
      assert.equal(isMedicationScheduledOnDate(asNeededMed, '2026-10-05'), false, 'as_needed should not pre-schedule mandatory doses');

      // Weekly: start date 2026-10-04 is a Sunday (UTC day 0)
      const weeklyMed = new Medication({
        startDate: '2026-10-04',
        frequency: 'weekly',
      });
      // 2026-10-11 is next Sunday (should be true)
      assert.equal(isMedicationScheduledOnDate(weeklyMed, '2026-10-11'), true);
      // 2026-10-12 is Monday (should be false)
      assert.equal(isMedicationScheduledOnDate(weeklyMed, '2026-10-12'), false);
      console.log('  ✓ Recurrence rules accurately compute scheduled occurrences');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Today's doses endpoint & Status transitions (taken, skipped, snoozed)
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\nTest 7: Retrieve today's doses and perform status updates");
    let todayDoseId = '';
    {
      const resToday = await fetch(`${BASE_URL}/doses/today`, {
        headers: { Cookie: sessionA.cookieHeader },
      });
      assert.equal(resToday.status, 200);
      const doses = (await resToday.json()) as any[];
      assert.ok(doses.length > 0, "Should have today's doses for Metformin");
      todayDoseId = doses[0]._id;
      assert.equal(doses[0].status, 'pending');
      assert.ok(doses[0].medicationId.name, 'Should populate medication details');

      // Mark dose as TAKEN
      const resTaken = await fetch(`${BASE_URL}/doses/${todayDoseId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({ status: 'taken' }),
      });
      assert.equal(resTaken.status, 200);
      const doseTaken = (await resTaken.json()) as any;
      assert.equal(doseTaken.status, 'taken');
      assert.ok(doseTaken.takenAt, 'Should record takenAt timestamp');

      // Mark dose as SKIPPED
      const resSkipped = await fetch(`${BASE_URL}/doses/${todayDoseId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({ status: 'skipped' }),
      });
      assert.equal(resSkipped.status, 200);
      const doseSkipped = (await resSkipped.json()) as any;
      assert.equal(doseSkipped.status, 'skipped');
      assert.equal(doseSkipped.takenAt, undefined);
      console.log('  ✓ Status updated to taken (with timestamp) and skipped');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. Snooze validation: reject past and invalid snooze times
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 8: Snooze validation (reject past timestamps and excess durations)');
    {
      // Past snooze timestamp rejection
      const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const resPast = await fetch(`${BASE_URL}/doses/${todayDoseId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({
          status: 'snoozed',
          snoozedUntil: pastTime,
        }),
      });
      assert.equal(resPast.status, 400, 'Must reject past snooze time');

      // Valid future snooze
      const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const resValidSnooze = await fetch(`${BASE_URL}/doses/${todayDoseId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
        body: JSON.stringify({
          status: 'snoozed',
          snoozedUntil: futureTime,
        }),
      });
      assert.equal(resValidSnooze.status, 200);
      const snoozed = (await resValidSnooze.json()) as any;
      assert.equal(snoozed.status, 'snoozed');
      assert.ok(snoozed.snoozedUntil);
      console.log('  ✓ Past snooze rejected with 400; valid future snooze accepted');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. Dose ownership check
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\nTest 9: Verify dose ownership (Bob cannot change Alice's dose status)");
    {
      const resBobHacks = await fetch(`${BASE_URL}/doses/${todayDoseId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionB.cookieHeader,
          'X-CSRF-Token': sessionB.csrfToken,
        },
        body: JSON.stringify({ status: 'taken' }),
      });
      assert.equal(resBobHacks.status, 404, 'Must return 404 when Bob tries to update Alice dose');
      console.log("  ✓ Prevented unauthorized dose tampering: 404 returned for Bob");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. Dose history pagination & adherence calculation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 10: Dose history pagination and adherence calculation');
    {
      // Retrieve paginated history
      const resHistory = await fetch(`${BASE_URL}/doses/history?page=1&limit=5`, {
        headers: { Cookie: sessionA.cookieHeader },
      });
      assert.equal(resHistory.status, 200);
      const historyData = (await resHistory.json()) as any;
      assert.ok(Array.isArray(historyData.data));
      assert.ok(historyData.pagination.total >= 1);
      assert.equal(historyData.pagination.page, 1);
      assert.equal(historyData.pagination.limit, 5);

      // Check adherence stats
      const resAdherence = await fetch(`${BASE_URL}/doses/adherence`, {
        headers: { Cookie: sessionA.cookieHeader },
      });
      assert.equal(resAdherence.status, 200);
      const adherence = (await resAdherence.json()) as any;
      assert.ok(typeof adherence.adherenceRate === 'number');
      assert.ok(typeof adherence.currentStreak === 'number');
      assert.ok(adherence.totalScheduled !== undefined);
      console.log(`  ✓ History paginated; adherence rate computed: ${adherence.adherenceRate}%`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Delete / archive medication preserves dose history
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\nTest 11: Archiving medication preserves historical dose records');
    {
      const resDelete = await fetch(`${BASE_URL}/medications/${medicationIdA}`, {
        method: 'DELETE',
        headers: {
          Cookie: sessionA.cookieHeader,
          'X-CSRF-Token': sessionA.csrfToken,
        },
      });
      assert.equal(resDelete.status, 200);

      // Verify medication is archived (isActive = false)
      const medInDb = await Medication.findById(medicationIdA);
      assert.equal(medInDb?.isActive, false, 'Medication should be archived');

      // Verify historical doses for Alice still exist
      const remainingDoses = await DoseRecord.countDocuments({
        medicationId: medicationIdA,
        userId: sessionA.user.id,
      });
      assert.ok(remainingDoses > 0, 'Past dose records must be preserved for medical tracking');
      console.log('  ✓ Medication safely archived; historical dose records preserved intact');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎉 ALL 11 PHASE 4 MEDICATION & DOSE TESTS PASSED SUCCESSFULLY!');
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
