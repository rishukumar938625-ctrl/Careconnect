/**
 * Comprehensive Automated Test Suite for Phase 5: Doctor Directory and Appointment Scheduling
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { Doctor, IDoctor } from '../models/Doctor.js';
import { Appointment, IAppointment } from '../models/Appointment.js';
import { User } from '../models/User.js';
import authRoutes from '../routes/authRoutes.js';
import doctorRoutes from '../routes/doctorRoutes.js';
import appointmentRoutes from '../routes/appointmentRoutes.js';
import medicationRoutes from '../routes/medicationRoutes.js';
import doseRoutes from '../routes/doseRoutes.js';
import healthRoutes from '../routes/healthRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

const TEST_PORT = 5096;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/doses', doseRoutes);
app.use(errorHandler);

let mongoServer: MongoMemoryServer;
let server: http.Server;

// Helper to calculate future date string (e.g. 5 days from today) on a weekday
function getFutureWeekday(daysAhead = 3): { dateStr: string; dayName: string } {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  // If Saturday (6) or Sunday (0), advance to Monday
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return { dateStr: `${y}-${m}-${day}`, dayName: days[d.getDay()] };
}

async function runTests() {
  console.log('🧪 Starting Phase 5 Doctor Directory & Appointment Scheduling Test Suite...\n');

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

    // Helper to register a test user and obtain auth cookies & csrf token
    async function createTestUserSession(emailPrefix: string) {
      const email = `${emailPrefix}.${Date.now()}@test.careconnect.app`;
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `User ${emailPrefix}`,
          email,
          password: 'Password123!',
        }),
      });

      const data = await res.json() as any;
      const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];

      let authCookie = '';
      let csrfCookie = '';
      for (const c of rawCookies) {
        if (c.includes('careconnect_token=')) authCookie = c.split(';')[0];
        if (c.includes('careconnect_csrf_token=')) csrfCookie = c.split(';')[0];
      }

      const cookieHeader = [authCookie, csrfCookie].filter(Boolean).join('; ');
      const csrfToken = data.csrfToken || csrfCookie.replace('careconnect_csrf_token=', '');

      return {
        user: data.user,
        cookie: cookieHeader,
        csrfToken,
      };
    }

    // Seed Demo Doctors
    const testDoctor = await Doctor.create({
      slug: 'test-doc-foster',
      name: 'Dr. Helen Foster',
      specialty: 'General Physician',
      qualifications: 'MBBS, MD (Simulated Demo Credential)',
      experienceYears: 10,
      experience: '10 years',
      hospital: 'CareConnect Demo Family Clinic',
      rating: 4.8,
      reviewCount: 150,
      consultationFee: 60,
      consultationDurationMinutes: 30,
      consultationType: 'both',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      workingHours: { start: '09:00', end: '17:00' },
      blockedDates: ['2026-12-25'],
      timezone: 'UTC',
      isActive: true,
      isAvailable: true,
      avatarInitials: 'HF',
      avatarColor: '#2563EB',
      languages: ['English'],
      isDemo: true,
      bio: '[DEMO DATA — Fictional healthcare profile for testing.]',
    });

    const testCardioDoctor = await Doctor.create({
      slug: 'test-doc-adams',
      name: 'Dr. Robert Adams',
      specialty: 'Cardiologist',
      qualifications: 'MBBS, DM (Cardiology Demo)',
      experienceYears: 14,
      experience: '14 years',
      hospital: 'Metro Heart Demo Center',
      rating: 4.9,
      reviewCount: 220,
      consultationFee: 95,
      consultationDurationMinutes: 45,
      consultationType: 'both',
      workingDays: ['Tuesday', 'Thursday'],
      workingHours: { start: '10:00', end: '16:00' },
      blockedDates: [],
      timezone: 'UTC',
      isActive: true,
      isAvailable: true,
      avatarInitials: 'RA',
      avatarColor: '#EA580C',
      languages: ['English'],
      isDemo: true,
      bio: '[DEMO DATA — Fictional cardiologist.]',
    });

    // Inactive doctor (should be hidden by activeOnly filter)
    await Doctor.create({
      slug: 'test-doc-inactive',
      name: 'Dr. Inactive Specialist',
      specialty: 'Dermatologist',
      qualifications: 'Demo',
      experienceYears: 4,
      hospital: 'Inactive Clinic',
      rating: 4.0,
      reviewCount: 10,
      consultationFee: 40,
      consultationDurationMinutes: 30,
      consultationType: 'in-person',
      workingDays: ['Monday'],
      workingHours: { start: '09:00', end: '12:00' },
      isActive: false,
      isAvailable: false,
      languages: ['English'],
      isDemo: true,
    });

    console.log('👩‍⚕️ Created 3 test doctors (2 active, 1 inactive)\n');

    // Create 2 test users
    const alice = await createTestUserSession('alice');
    const bob = await createTestUserSession('bob');

    // ──────────────────────────────────────────────────────────────────────────
    // Test 1: Doctor listing, search, specialty filters, and pagination
    // ──────────────────────────────────────────────────────────────────────────
    console.log('Test 1: Doctor listing, search, specialty filters, and pagination');
    {
      // 1a. List active doctors
      const listRes = await fetch(`${BASE_URL}/doctors`);
      assert.strictEqual(listRes.status, 200);
      const listData = await listRes.json() as any;
      assert.ok(Array.isArray(listData.data));
      assert.strictEqual(listData.data.length, 2, 'Should return only active doctors');
      assert.ok(listData.pagination, 'Should include pagination meta');

      // 1b. Specialty filtering
      const cardioRes = await fetch(`${BASE_URL}/doctors?specialty=Cardiologist`);
      const cardioData = await cardioRes.json() as any;
      assert.strictEqual(cardioData.data.length, 1);
      assert.strictEqual(cardioData.data[0].slug, 'test-doc-adams');

      // 1c. Name search
      const searchRes = await fetch(`${BASE_URL}/doctors?q=Foster`);
      const searchData = await searchRes.json() as any;
      assert.strictEqual(searchData.data.length, 1);
      assert.strictEqual(searchData.data[0].slug, 'test-doc-foster');

      // 1d. Get single doctor by ID and slug
      const slugRes = await fetch(`${BASE_URL}/doctors/test-doc-foster`);
      assert.strictEqual(slugRes.status, 200);
      const docBySlug = await slugRes.json() as any;
      assert.strictEqual(docBySlug.name, 'Dr. Helen Foster');

      const idRes = await fetch(`${BASE_URL}/doctors/${testDoctor._id}`);
      assert.strictEqual(idRes.status, 200);

      // Inactive doctor returns 404
      const inactiveRes = await fetch(`${BASE_URL}/doctors/test-doc-inactive`);
      assert.strictEqual(inactiveRes.status, 404);

      console.log('  ✓ Verified active filtering, specialty queries, search, and pagination');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 2: Doctor availability for valid and invalid dates
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTest 2: Doctor availability for valid and invalid dates');
    const targetWeekday = getFutureWeekday(4);
    {
      // 2a. Valid date returns computed slots
      const availRes = await fetch(
        `${BASE_URL}/doctors/${testDoctor._id}/availability?date=${targetWeekday.dateStr}`
      );
      assert.strictEqual(availRes.status, 200);
      const availData = await availRes.json() as any;
      assert.strictEqual(availData.status, 'success');
      assert.strictEqual(availData.data.isWorkingDay, true);
      assert.ok(availData.data.slots.length > 0, 'Should generate working slots (09:00 - 17:00)');
      assert.strictEqual(availData.data.totalSlots, 16, '16 thirty-minute slots in an 8-hour window');
      assert.strictEqual(availData.data.availableCount, 16);

      // 2b. Invalid date format returns 400
      const badDateRes = await fetch(
        `${BASE_URL}/doctors/${testDoctor._id}/availability?date=not-a-date`
      );
      assert.strictEqual(badDateRes.status, 400);

      // 2c. Past date rejects with empty slots and explanatory message
      const pastAvailRes = await fetch(
        `${BASE_URL}/doctors/${testDoctor._id}/availability?date=2020-01-01`
      );
      assert.strictEqual(pastAvailRes.status, 200);
      const pastData = await pastAvailRes.json() as any;
      assert.strictEqual(pastData.data.isWorkingDay, false);
      assert.strictEqual(pastData.data.slots.length, 0);

      // 2d. Non-working day (e.g. Sunday) returns no slots
      const sundayRes = await fetch(
        `${BASE_URL}/doctors/${testDoctor._id}/availability?date=2026-10-18` // 2026-10-18 is a Sunday
      );
      const sundayData = await sundayRes.json() as any;
      assert.strictEqual(sundayData.data.isWorkingDay, false);
      assert.strictEqual(sundayData.data.slots.length, 0);

      console.log('  ✓ Availability computes time slots, validates formats, and enforces working days');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 3: Booking a valid available slot
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTest 3: Booking a valid available slot');
    let aliceAppointment: any = null;
    const testSlotStart = `${targetWeekday.dateStr}T10:00:00.000Z`;
    {
      const bookRes = await fetch(`${BASE_URL}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
          'X-CSRF-Token': alice.csrfToken,
        },
        body: JSON.stringify({
          doctorId: testDoctor._id.toString(),
          startAt: testSlotStart,
          type: 'in-person',
          reason: 'Annual wellness exam and blood pressure check',
        }),
      });

      assert.strictEqual(bookRes.status, 201, 'Should return 201 Created');
      aliceAppointment = await bookRes.json();
      assert.strictEqual(aliceAppointment.patientId, alice.user.id);
      assert.strictEqual(aliceAppointment.doctorId, testDoctor._id.toString());
      assert.strictEqual(aliceAppointment.status, 'booked');
      assert.strictEqual(new Date(aliceAppointment.startAt).toISOString(), testSlotStart);

      // Verify availability endpoint now shows this slot as booked
      const refreshAvail = await fetch(
        `${BASE_URL}/doctors/${testDoctor._id}/availability?date=${targetWeekday.dateStr}`
      );
      const refreshData = await refreshAvail.json() as any;
      const bookedSlot = refreshData.data.slots.find((s: any) => s.startAt === testSlotStart);
      assert.ok(bookedSlot, 'Slot should exist in schedule');
      assert.strictEqual(bookedSlot.available, false, 'Booked slot must be marked unavailable');
      assert.strictEqual(bookedSlot.unavailableReason, 'booked');
      assert.strictEqual(refreshData.data.availableCount, 15, 'Available count should decrease by 1');

      console.log('  ✓ Successfully booked slot with 201, UTC persistence, and real-time slot lock');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 4: Rejecting a past or unavailable slot
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTest 4: Rejecting a past or unavailable slot');
    {
      // 4a. Reject past slot
      const pastBookRes = await fetch(`${BASE_URL}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: bob.cookie,
          'X-CSRF-Token': bob.csrfToken,
        },
        body: JSON.stringify({
          doctorId: testDoctor._id.toString(),
          startAt: '2020-05-10T10:00:00.000Z',
          type: 'in-person',
        }),
      });
      assert.strictEqual(pastBookRes.status, 400);

      // 4b. Reject slot outside working hours (e.g. 03:00 AM)
      const outsideHoursRes = await fetch(`${BASE_URL}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: bob.cookie,
          'X-CSRF-Token': bob.csrfToken,
        },
        body: JSON.stringify({
          doctorId: testDoctor._id.toString(),
          startAt: `${targetWeekday.dateStr}T03:00:00.000Z`,
          type: 'in-person',
        }),
      });
      assert.strictEqual(outsideHoursRes.status, 400);

      console.log('  ✓ Rejected past slots and out-of-schedule requests with 400');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 5: Rejecting overlapping appointments
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTest 5: Rejecting overlapping appointments');
    {
      // Bob tries to book the exact same slot that Alice booked (10:00 AM)
      const conflictRes = await fetch(`${BASE_URL}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: bob.cookie,
          'X-CSRF-Token': bob.csrfToken,
        },
        body: JSON.stringify({
          doctorId: testDoctor._id.toString(),
          startAt: testSlotStart,
          type: 'video',
          reason: 'Conflicting appointment attempt',
        }),
      });

      assert.strictEqual(conflictRes.status, 409, 'Conflict must return 409');
      const conflictData = await conflictRes.json() as any;
      assert.strictEqual(conflictData.status, 'error');

      console.log('  ✓ Overlapping appointment rejected with 409 Conflict');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 6: Concurrent booking attempts for the same slot
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTest 6: Concurrent booking attempts for the same slot');
    {
      const concurrentSlotStart = `${targetWeekday.dateStr}T11:00:00.000Z`;

      // Two simultaneous requests for the exact same slot
      const [resA, resB] = await Promise.all([
        fetch(`${BASE_URL}/appointments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: alice.cookie,
            'X-CSRF-Token': alice.csrfToken,
          },
          body: JSON.stringify({
            doctorId: testDoctor._id.toString(),
            startAt: concurrentSlotStart,
            type: 'in-person',
          }),
        }),
        fetch(`${BASE_URL}/appointments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: bob.cookie,
            'X-CSRF-Token': bob.csrfToken,
          },
          body: JSON.stringify({
            doctorId: testDoctor._id.toString(),
            startAt: concurrentSlotStart,
            type: 'in-person',
          }),
        }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      assert.deepStrictEqual(
        statuses,
        [201, 409],
        'One booking must succeed (201) and the concurrent duplicate must fail with 409 Conflict'
      );

      // Verify in database that exactly ONE appointment was created for that slot
      const activeCount = await Appointment.countDocuments({
        doctorId: testDoctor._id,
        startAt: new Date(concurrentSlotStart),
        status: { $in: ['booked', 'upcoming'] },
      });
      assert.strictEqual(activeCount, 1, 'Database must contain exactly 1 active record');

      console.log('  ✓ Double-booking safely prevented under concurrent load via database atomic index');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 7: Successful rescheduling to an available slot
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTest 7: Successful rescheduling to an available slot');
    const rescheduledSlotStart = `${targetWeekday.dateStr}T14:00:00.000Z`;
    {
      const reschRes = await fetch(`${BASE_URL}/appointments/${aliceAppointment._id}/reschedule`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
          'X-CSRF-Token': alice.csrfToken,
        },
        body: JSON.stringify({
          startAt: rescheduledSlotStart,
          reason: 'Rescheduled for afternoon consultation',
        }),
      });

      assert.strictEqual(reschRes.status, 200);
      const reschData = await reschRes.json() as any;
      assert.strictEqual(reschData.appointment.status, 'booked');
      assert.strictEqual(new Date(reschData.appointment.startAt).toISOString(), rescheduledSlotStart);

      // Verify the old slot (10:00 AM) is now freed up and available
      const availCheck = await fetch(
        `${BASE_URL}/doctors/${testDoctor._id}/availability?date=${targetWeekday.dateStr}`
      );
      const availCheckData = await availCheck.json() as any;
      const oldSlot = availCheckData.data.slots.find((s: any) => s.startAt === testSlotStart);
      assert.strictEqual(oldSlot.available, true, 'Original slot must be released upon reschedule');

      console.log('  ✓ Successfully rescheduled appointment and released original slot');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 8: Rejection of rescheduling into a conflicting slot
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTest 8: Rejection of rescheduling into a conflicting slot');
    {
      // Bob books 15:00 PM
      const bobSlotStart = `${targetWeekday.dateStr}T15:00:00.000Z`;
      const bobBook = await fetch(`${BASE_URL}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: bob.cookie,
          'X-CSRF-Token': bob.csrfToken,
        },
        body: JSON.stringify({
          doctorId: testDoctor._id.toString(),
          startAt: bobSlotStart,
          type: 'in-person',
        }),
      });
      assert.strictEqual(bobBook.status, 201);

      // Alice tries to reschedule into Bob's 15:00 PM slot -> Conflict
      const badReschedule = await fetch(`${BASE_URL}/appointments/${aliceAppointment._id}/reschedule`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
          'X-CSRF-Token': alice.csrfToken,
        },
        body: JSON.stringify({
          startAt: bobSlotStart,
        }),
      });

      assert.strictEqual(badReschedule.status, 409, 'Must reject conflicting reschedule with 409');
      console.log('  ✓ Conflicting reschedule rejected with 409 Conflict');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 9: Cancellation and prevention of invalid status transitions
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTest 9: Cancellation and prevention of invalid status transitions');
    {
      // 9a. Alice cancels her appointment
      const cancelRes = await fetch(`${BASE_URL}/appointments/${aliceAppointment._id}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
          'X-CSRF-Token': alice.csrfToken,
        },
        body: JSON.stringify({
          cancellationReason: 'Work schedule change',
        }),
      });

      assert.strictEqual(cancelRes.status, 200);
      const cancelData = await cancelRes.json() as any;
      assert.strictEqual(cancelData.appointment.status, 'cancelled');

      // 9b. Cannot cancel an already-cancelled appointment
      const repeatCancel = await fetch(`${BASE_URL}/appointments/${aliceAppointment._id}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
          'X-CSRF-Token': alice.csrfToken,
        },
      });
      assert.strictEqual(repeatCancel.status, 400);

      // 9c. Cannot reschedule a cancelled appointment
      const rescheduleCancelled = await fetch(
        `${BASE_URL}/appointments/${aliceAppointment._id}/reschedule`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: alice.cookie,
            'X-CSRF-Token': alice.csrfToken,
          },
          body: JSON.stringify({
            startAt: `${targetWeekday.dateStr}T16:00:00.000Z`,
          }),
        }
      );
      assert.strictEqual(rescheduleCancelled.status, 400);

      console.log('  ✓ Cancelled appointment and blocked invalid transitions (repeat cancel & reschedule)');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 10: Patient appointment history and pagination
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTest 10: Patient appointment history and pagination');
    {
      const historyRes = await fetch(`${BASE_URL}/appointments/history?page=1&limit=10`, {
        headers: {
          Cookie: alice.cookie,
        },
      });

      assert.strictEqual(historyRes.status, 200);
      const historyData = await historyRes.json() as any;
      assert.ok(Array.isArray(historyData.data));
      assert.ok(historyData.pagination);
      assert.strictEqual(historyData.pagination.page, 1);
      assert.ok(historyData.data.length >= 1);

      console.log('  ✓ Paginated history returned with standard metadata and sorting');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 11: Authentication and cross-user ownership protections
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTest 11: Authentication and cross-user ownership protections');
    {
      // 11a. Unauthenticated request to /api/appointments returns 401
      const unauthRes = await fetch(`${BASE_URL}/appointments`);
      assert.strictEqual(unauthRes.status, 401);

      // 11b. Cross-user access: Bob cannot view Alice's appointment (404)
      const crossRead = await fetch(`${BASE_URL}/appointments/${aliceAppointment._id}`, {
        headers: {
          Cookie: bob.cookie,
        },
      });
      assert.strictEqual(crossRead.status, 404, 'Must return 404 for inaccessbile cross-user appointment');

      // 11c. Cross-user tampering: Bob cannot cancel Alice's appointment (404)
      const crossCancel = await fetch(`${BASE_URL}/appointments/${aliceAppointment._id}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: bob.cookie,
          'X-CSRF-Token': bob.csrfToken,
        },
      });
      assert.strictEqual(crossCancel.status, 404);

      // 11d. CSRF validation on booking: Missing CSRF token returns 403
      const noCsrfRes = await fetch(`${BASE_URL}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: alice.cookie,
        },
        body: JSON.stringify({
          doctorId: testDoctor._id.toString(),
          startAt: `${targetWeekday.dateStr}T16:00:00.000Z`,
        }),
      });
      assert.strictEqual(noCsrfRes.status, 403, 'Missing CSRF token must return 403');

      console.log('  ✓ Enforced 401 unauthenticated, 404 cross-user ownership isolation, and 403 CSRF enforcement');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 12: Time-zone display and UTC persistence
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTest 12: Time-zone display and UTC persistence');
    {
      // Verify directly from MongoDB document
      const dbDoc = await Appointment.findById(aliceAppointment._id);
      assert.ok(dbDoc);
      assert.ok(dbDoc.startAt instanceof Date);
      assert.strictEqual(dbDoc.timezone, 'UTC');
      assert.strictEqual(dbDoc.startAt.toISOString(), rescheduledSlotStart);

      console.log('  ✓ Verified exact UTC timestamp persistence and timezone preservation in MongoDB');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Test 13: Existing Health Information, authentication, and Medication Reminders functionality
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTest 13: Regression checks for Health Info, Auth, and Medication Reminders');
    {
      // Health endpoints
      const healthRes = await fetch(`${BASE_URL}/health`);
      assert.strictEqual(healthRes.status, 200);

      const dbHealth = await fetch(`${BASE_URL}/health/db`);
      assert.strictEqual(dbHealth.status, 200);

      // Auth current user
      const meRes = await fetch(`${BASE_URL}/auth/me`, {
        headers: { Cookie: alice.cookie },
      });
      assert.strictEqual(meRes.status, 200);

      // Medication endpoint
      const medRes = await fetch(`${BASE_URL}/medications`, {
        headers: { Cookie: alice.cookie },
      });
      assert.strictEqual(medRes.status, 200);

      console.log('  ✓ Preserved full backward compatibility for Phases 1 through 4');
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎉 ALL 13 PHASE 5 APPOINTMENT & SCHEDULING TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════════════\n');

    process.exitCode = 0;
  } catch (error) {
    console.error('❌ Phase 5 Test Suite Failed:', error);
    process.exitCode = 1;
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    process.exit(process.exitCode || 0);
  }
}

runTests();
