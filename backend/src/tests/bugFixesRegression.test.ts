/**
 * Bug Fixes Regression Test Suite
 *
 * Verifies fixes for:
 * 1. Bug 6: Rejection of unauthenticated bookmarking without mutating shared records
 * 2. Bug 7: Orphan dose cleanup on schedule update, deactivation cleanup, and getTodayDoses active check
 * 3. Bug 8: Adherence streak calculation strictly enforcing consecutive calendar days
 * 4. Bug 9: Clearing optional medication fields (instructions, endDate)
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
import { Condition } from '../models/Condition.js';
import { Medicine } from '../models/Medicine.js';
import { Article } from '../models/Article.js';
import { NotificationJob } from '../models/NotificationJob.js';

import authRoutes from '../routes/authRoutes.js';
import healthRoutes from '../routes/healthRoutes.js';
import conditionRoutes from '../routes/conditionRoutes.js';
import medicineRoutes from '../routes/medicineRoutes.js';
import articleRoutes from '../routes/articleRoutes.js';
import medicationRoutes from '../routes/medicationRoutes.js';
import doseRoutes from '../routes/doseRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { formatDateStr } from '../utils/scheduler.js';

const TEST_PORT = 5098;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/conditions', conditionRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/medications', medicationRoutes);
app.use('/api/doses', doseRoutes);
app.use(errorHandler);

let mongoServer: MongoMemoryServer;
let server: http.Server;

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  cookie?: string;
}

interface ResponseResult<T = any> {
  status: number;
  body: T;
  headers: http.IncomingHttpHeaders;
  cookies: string[];
}

function request<T = any>(path: string, options: RequestOptions = {}): Promise<ResponseResult<T>> {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (options.cookie) {
      reqHeaders['Cookie'] = options.cookie;
    }

    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers: reqHeaders,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          const rawCookies = res.headers['set-cookie'] || [];
          const cookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies];
          resolve({
            status: res.statusCode || 0,
            body: parsed,
            headers: res.headers,
            cookies,
          });
        });
      }
    );

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

function extractCookie(cookies: string[], name: string): string {
  for (const c of cookies) {
    if (c.startsWith(`${name}=`)) {
      return c.split(';')[0];
    }
  }
  return '';
}

async function runTests() {
  console.log('🧪 Starting Bug Fixes Regression Test Suite...\n');

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

    // ─── Test 1: Bug 6 - Bookmark Endpoint Security & Immutability ─────────────
    console.log('▶ Test 1: Unauthenticated bookmark requests must return 401 without mutating DB');

    // Seed sample condition, medicine, and article
    await Condition.create({
      slug: 'test-condition',
      name: 'Test Condition',
      category: 'Respiratory',
      shortDescription: 'Short description for condition',
      overview: 'Overview for condition',
      description: 'Full description',
      severity: 'mild',
      symptoms: ['Symptom A'],
      causes: ['Cause A'],
      prevention: ['Prevention A'],
      whenToSeekMedicalHelp: ['When to seek help'],
      tags: ['tag1'],
      bookmarked: false,
    });

    await Medicine.create({
      slug: 'test-medicine',
      name: 'Test Medicine',
      genericName: 'Generic Test',
      category: 'Analgesics',
      shortDescription: 'Short description for medicine',
      description: 'Full description',
      commonUses: ['Pain relief'],
      generalSafetyInformation: 'Take as directed',
      commonSideEffects: ['Nausea'],
      warnings: ['Do not exceed dose'],
      forms: ['Tablet'],
      requiresPrescription: false,
      bookmarked: false,
    });

    await Article.create({
      slug: 'test-article',
      title: 'Test Article',
      category: 'Wellness',
      summary: 'Summary of article',
      shortDescription: 'Short description for article',
      content: 'Full article text content',
      readingTimeMinutes: 5,
      author: {
        name: 'Editor',
        role: 'Doctor',
      },
      publishedAt: '2026-01-01',
      bookmarked: false,
    });

    // Attempt bookmarking without authentication on /api/conditions/:slug/bookmark
    const unauthCondRes = await request('/conditions/test-condition/bookmark', {
      method: 'POST',
    });
    assert.equal(unauthCondRes.status, 401, 'Should return 401 Unauthorized when not logged in');

    // Verify condition.bookmarked in DB was NOT changed
    const condInDb = await Condition.findOne({ slug: 'test-condition' });
    assert.equal(condInDb?.bookmarked, false, 'Shared condition document must not be mutated by unauthenticated requests');

    // Attempt bookmarking without authentication on /api/health/conditions/:slug/bookmark
    const healthCondRes = await request('/health/conditions/test-condition/bookmark', {
      method: 'POST',
    });
    assert.equal(healthCondRes.status, 401, 'Health route should also require authentication');

    // Attempt unauthenticated bookmark on medicine
    const unauthMedRes = await request('/medicines/test-medicine/bookmark', {
      method: 'POST',
    });
    assert.equal(unauthMedRes.status, 401, 'Medicine bookmarking must require authentication');
    const medInDb = await Medicine.findOne({ slug: 'test-medicine' });
    assert.equal(medInDb?.bookmarked, false, 'Shared medicine document must not be mutated');

    // Attempt unauthenticated bookmark on article
    const unauthArtRes = await request('/articles/test-article/bookmark', {
      method: 'POST',
    });
    assert.equal(unauthArtRes.status, 401, 'Article bookmarking must require authentication');
    const artInDb = await Article.findOne({ slug: 'test-article' });
    assert.equal(artInDb?.bookmarked, false, 'Shared article document must not be mutated');

    console.log('  ✔ Unauthenticated bookmark requests securely rejected without modifying database records\n');

    // ─── Setup Authenticated User for Remaining Tests ─────────────────────────
    const regRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Audit User',
        email: 'audit.tester@careconnect.test',
        password: 'Password123!',
      },
    });
    assert.equal(regRes.status, 201, 'User registration should succeed');
    const tokenCookie = extractCookie(regRes.cookies, 'careconnect_token');
    const csrfCookie = extractCookie(regRes.cookies, 'careconnect_csrf_token');
    const csrfToken = regRes.body.csrfToken;
    const authHeaders = {
      'x-csrf-token': csrfToken,
    };
    const authCookie = `${tokenCookie}; ${csrfCookie}`;

    // ─── Test 2: Bug 7 - Medication Schedule Update & Orphan Dose Cleanup ─────
    console.log('▶ Test 2: Medication schedule update must clean up obsolete pending doses and reschedule');

    const todayStr = formatDateStr(new Date());

    const createMedRes = await request('/medications', {
      method: 'POST',
      cookie: authCookie,
      headers: authHeaders,
      body: {
        name: 'Amoxicillin',
        dosage: '500mg',
        form: 'capsule',
        frequency: 'once_daily',
        timesOfDay: ['08:00'],
        startDate: todayStr,
        reminderEnabled: true,
      },
    });
    assert.equal(createMedRes.status, 201, 'Should create medication');
    const medId = createMedRes.body._id;

    // Verify initial doses created at 08:00
    const initialDoses = await DoseRecord.find({
      medicationId: medId,
      status: 'pending',
    });
    assert.ok(initialDoses.length >= 7, 'Should have generated doses for 7 days');
    assert.ok(initialDoses.every((d) => d.scheduledTime === '08:00'), 'All initial doses should be at 08:00');

    // Now update schedule: change timesOfDay from 08:00 to 14:00
    const updateMedRes = await request(`/medications/${medId}`, {
      method: 'PUT',
      cookie: authCookie,
      headers: authHeaders,
      body: {
        timesOfDay: ['14:00'],
      },
    });
    assert.equal(updateMedRes.status, 200, 'Should successfully update medication');

    // Verify that old 08:00 pending doses for today and future are GONE
    const remaining08Doses = await DoseRecord.find({
      medicationId: medId,
      scheduledTime: '08:00',
      status: 'pending',
      scheduledDate: { $gte: todayStr },
    });
    assert.equal(remaining08Doses.length, 0, 'No obsolete 08:00 pending doses should remain');

    // Verify that new 14:00 doses are present
    const new14Doses = await DoseRecord.find({
      medicationId: medId,
      scheduledTime: '14:00',
      status: 'pending',
      scheduledDate: { $gte: todayStr },
    });
    assert.ok(new14Doses.length >= 7, 'Should have generated doses for 14:00');

    console.log('  ✔ Schedule change properly purged obsolete doses and generated updated schedule\n');

    // ─── Test 3: Bug 7 - Medication Archival and getTodayDoses Active Check ───
    console.log('▶ Test 3: Archived medication pending doses are deleted and excluded from today doses');

    // Create a dose record for today marked as taken (historical)
    const takenDose = await DoseRecord.create({
      userId: regRes.body.user.id,
      medicationId: medId,
      scheduledAt: new Date(),
      scheduledDate: todayStr,
      scheduledTime: '09:00',
      timezone: 'UTC',
      status: 'taken',
      takenAt: new Date(),
    });

    // Archive the medication
    const archiveRes = await request(`/medications/${medId}`, {
      method: 'DELETE',
      cookie: authCookie,
      headers: authHeaders,
    });
    assert.equal(archiveRes.status, 200, 'Medication archival should succeed');

    // Verify historical taken dose is still preserved
    const takenCheck = await DoseRecord.findById(takenDose._id);
    assert.ok(takenCheck !== null, 'Historical taken dose must be preserved');
    assert.equal(takenCheck.status, 'taken');

    // Verify all pending doses for today and future are removed
    const pendingCountAfterArchive = await DoseRecord.countDocuments({
      medicationId: medId,
      status: 'pending',
      scheduledDate: { $gte: todayStr },
    });
    assert.equal(pendingCountAfterArchive, 0, 'Pending doses must be purged upon archival');

    // Verify getTodayDoses excludes archived medications
    const todayDosesRes = await request('/doses/today', {
      method: 'GET',
      cookie: authCookie,
    });
    assert.equal(todayDosesRes.status, 200);
    const activeTodayDoses = todayDosesRes.body.filter(
      (d: any) => d.medicationId?._id === medId || d.medicationId?.id === medId
    );
    assert.equal(activeTodayDoses.length, 0, 'Archived medication must not show in today active doses');

    console.log('  ✔ Medication archival preserves history, purges future doses, and filters from today doses\n');

    // ─── Test 4: Bug 8 - Adherence Streak Consecutive Day Check ───────────────
    console.log('▶ Test 4: Adherence streak calculation requires strictly consecutive calendar days');

    // Create an active test medication for adherence stats
    const activeMed = await Medication.create({
      userId: regRes.body.user.id,
      name: 'Vitamin D',
      dosage: '1000 IU',
      form: 'tablet',
      frequency: 'once_daily',
      timesOfDay: ['09:00'],
      startDate: '2026-01-01',
      isActive: true,
    });

    // Clear old doses for clean stats test
    await DoseRecord.deleteMany({ userId: regRes.body.user.id });

    // Scenario A: Two 100% adherence days separated by 10 days
    // Day 1: 2026-10-20 (taken)
    await DoseRecord.create({
      userId: regRes.body.user.id,
      medicationId: activeMed._id,
      scheduledAt: new Date('2026-10-20T09:00:00Z'),
      scheduledDate: '2026-10-20',
      scheduledTime: '09:00',
      timezone: 'UTC',
      status: 'taken',
    });

    // Day 2: 2026-10-10 (taken) - 10 days gap
    await DoseRecord.create({
      userId: regRes.body.user.id,
      medicationId: activeMed._id,
      scheduledAt: new Date('2026-10-10T09:00:00Z'),
      scheduledDate: '2026-10-10',
      scheduledTime: '09:00',
      timezone: 'UTC',
      status: 'taken',
    });

    const statsRes1 = await request('/doses/adherence', {
      method: 'GET',
      cookie: authCookie,
    });
    assert.equal(statsRes1.status, 200);
    assert.equal(
      statsRes1.body.currentStreak,
      1,
      'Streak must NOT increment across non-consecutive days (10-day gap)'
    );

    // Scenario B: Add 2026-10-19 (strictly consecutive with 2026-10-20)
    await DoseRecord.create({
      userId: regRes.body.user.id,
      medicationId: activeMed._id,
      scheduledAt: new Date('2026-10-19T09:00:00Z'),
      scheduledDate: '2026-10-19',
      scheduledTime: '09:00',
      timezone: 'UTC',
      status: 'taken',
    });

    const statsRes2 = await request('/doses/adherence', {
      method: 'GET',
      cookie: authCookie,
    });
    assert.equal(statsRes2.status, 200);
    assert.equal(
      statsRes2.body.currentStreak,
      2,
      'Streak must be exactly 2 for consecutive days (Oct 20 and Oct 19), stopping at Oct 10 gap'
    );

    console.log('  ✔ Streak calculation correctly enforces strictly consecutive calendar days\n');

    // ─── Test 5: Bug 9 - Clearing Optional Fields on Medication Update ────────
    console.log('▶ Test 5: Clearing optional instructions and endDate persists cleanly');

    const medWithNotes = await Medication.create({
      userId: regRes.body.user.id,
      name: 'Ibuprofen',
      dosage: '400mg',
      form: 'tablet',
      frequency: 'once_daily',
      timesOfDay: ['10:00'],
      startDate: '2026-10-01',
      endDate: '2026-12-31',
      instructions: 'Take after food with water',
      isActive: true,
    });

    // Update with empty string to clear optional fields
    const clearRes = await request(`/medications/${medWithNotes._id}`, {
      method: 'PUT',
      cookie: authCookie,
      headers: authHeaders,
      body: {
        instructions: '',
        endDate: '',
      },
    });
    assert.equal(clearRes.status, 200, 'Update with cleared fields should succeed');

    const updatedMed = await Medication.findById(medWithNotes._id);
    assert.equal(updatedMed?.instructions, '', 'Instructions should be cleared to empty string');
    assert.equal(updatedMed?.endDate, undefined, 'EndDate should be cleared to undefined');

    console.log('  ✔ Optional instructions and endDate successfully cleared in database\n');

    console.log('🎉 All Bug Fix Regression Tests Passed Successfully!\n');
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
  }
}

runTests().catch((err) => {
  console.error('❌ Bug Fix Regression Suite Failed:', err);
  process.exit(1);
});
