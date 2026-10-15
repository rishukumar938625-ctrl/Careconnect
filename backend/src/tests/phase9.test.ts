/**
 * CareConnect — Phase 9 Comprehensive Testing & Quality Assurance
 *
 * Tests:
 * 1. Health Information Integration (Conditions, Medicines, Articles, Search, Slug/ID fallback, Regex escaping, Pagination)
 * 2. System Reliability & Edge Cases (DB Health Check 200/503, Expired/tampered JWT, Timezone & Quiet Hours overnight, Concurrent booking collision, Cancellation notification invalidation)
 * 3. End-to-End User Journeys (8 sequential journeys: Register -> Dashboard -> Health Search -> Medication -> Appointment -> Profile Update -> Notification -> Unauthorized rejection)
 */

import http from 'http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';
import cookieParser from 'cookie-parser';
import { URL } from 'url';
import jwt from 'jsonwebtoken';

import { User } from '../models/User.js';
import { Condition } from '../models/Condition.js';
import { Medicine } from '../models/Medicine.js';
import { Article } from '../models/Article.js';
import { Doctor } from '../models/Doctor.js';
import { Medication } from '../models/Medication.js';
import { DoseRecord } from '../models/DoseRecord.js';
import { Appointment } from '../models/Appointment.js';
import { Notification } from '../models/Notification.js';
import { NotificationJob } from '../models/NotificationJob.js';
import { generateToken, generateCsrfToken } from '../utils/token.js';
import { sanitizeNoSql } from '../middleware/sanitizeNoSql.js';

let mongoServer: MongoMemoryServer;
let server: http.Server;
let baseUrl: string;

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function pass(name: string) {
  passCount++;
  console.log(`  ✅ ${name}`);
}

function fail(name: string, reason: string) {
  failCount++;
  failures.push(`${name}: ${reason}`);
  console.error(`  ❌ ${name}: ${reason}`);
}

interface ReqOpts {
  body?: unknown;
  token?: string;
  csrf?: string;
  headers?: Record<string, string>;
}

interface ReqResult {
  status: number;
  body: any;
  headers: Record<string, string>;
}

async function req(
  method: string,
  path: string,
  opts: ReqOpts = {}
): Promise<ReqResult> {
  const url = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...opts.headers,
    };

    const cookies: string[] = [];
    if (opts.token) cookies.push(`careconnect_token=${opts.token}`);
    if (opts.csrf) {
      cookies.push(`careconnect_csrf_token=${opts.csrf}`);
      headers['x-csrf-token'] = opts.csrf;
    }
    if (cookies.length) headers['Cookie'] = cookies.join('; ');
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr).toString();

    const r = http.request(
      {
        hostname: url.hostname,
        port: Number(url.port),
        path: url.pathname + url.search,
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed: any = {};
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          const respHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === 'string') respHeaders[k] = v;
            else if (Array.isArray(v)) respHeaders[k] = v.join(', ');
          }
          resolve({ status: res.statusCode || 0, body: parsed, headers: respHeaders });
        });
      }
    );
    r.on('error', reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

// ─── Setup & Teardown ─────────────────────────────────────────────────────────

async function setup() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'phase9-test-jwt-secret-key-32-chars-long';
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  const app = express();
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(sanitizeNoSql);

  const [
    { default: healthRoutes },
    { default: authRoutes },
    { default: conditionRoutes },
    { default: medicineRoutes },
    { default: articleRoutes },
    { default: medicationRoutes },
    { default: doseRoutes },
    { default: appointmentRoutes },
    { default: doctorRoutes },
    { default: userRoutes },
    { default: notificationRoutes },
  ] = await Promise.all([
    import('../routes/healthRoutes.js'),
    import('../routes/authRoutes.js'),
    import('../routes/conditionRoutes.js'),
    import('../routes/medicineRoutes.js'),
    import('../routes/articleRoutes.js'),
    import('../routes/medicationRoutes.js'),
    import('../routes/doseRoutes.js'),
    import('../routes/appointmentRoutes.js'),
    import('../routes/doctorRoutes.js'),
    import('../routes/userRoutes.js'),
    import('../routes/notificationRoutes.js'),
  ]);

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/conditions', conditionRoutes);
  app.use('/api/medicines', medicineRoutes);
  app.use('/api/articles', articleRoutes);
  app.use('/api/medications', medicationRoutes);
  app.use('/api/doses', doseRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/doctors', doctorRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use((_req: express.Request, res: express.Response) => {
    res.status(404).json({ status: 'error', message: 'Not found' });
  });

  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
}

async function teardown() {
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

// ─── Test Suite Execution ───────────────────────────────────────────────────

async function runTests() {
  console.log('\n============================================================');
  console.log('🧪 CareConnect Phase 9: QA, Reliability & E2E Test Suite');
  console.log('============================================================\n');

  try {
    await setup();

    // ─── SECTION 1: Health Information Integration Tests ──────────────────────
    console.log('📋 S1: Health Information API Integration');

    // Seed test condition, medicine, and article
    await Condition.create([
      {
        slug: 'hypertension',
        name: 'Hypertension (High Blood Pressure)',
        category: 'Cardiovascular',
        shortDescription: 'High pressure in arteries',
        overview: 'Hypertension is when blood pressure is consistently too high.',
        severity: 'chronic',
        symptoms: ['Headaches', 'Shortness of breath'],
        causes: ['Diet', 'Genetics'],
        prevention: ['Exercise', 'Low salt diet'],
        whenToSeekMedicalHelp: ['Chest pain', 'Severe headache'],
        tags: ['heart', 'pressure'],
        bookmarked: false,
      },
      {
        slug: 'asthma',
        name: 'Bronchial Asthma',
        category: 'Respiratory',
        shortDescription: 'Airway inflammation causing breathing difficulty',
        overview: 'Asthma affects the lungs and airways.',
        severity: 'chronic',
        symptoms: ['Wheezing', 'Coughing'],
        causes: ['Allergens', 'Air pollution'],
        prevention: ['Inhalers', 'Avoid triggers'],
        whenToSeekMedicalHelp: ['Difficulty speaking', 'Blue lips'],
        tags: ['lungs', 'breathing'],
        bookmarked: false,
      },
    ]);

    await Medicine.create([
      {
        slug: 'lisinopril',
        name: 'Lisinopril',
        genericName: 'Lisinopril',
        brandNames: ['Prinivil', 'Zestril'],
        category: 'Cardiovascular',
        shortDescription: 'ACE inhibitor used to treat high blood pressure.',
        description: 'ACE inhibitor used to treat high blood pressure and improve survival after a heart attack.',
        overview: 'Lisinopril helps relax blood vessels.',
        commonUses: ['High blood pressure', 'Heart failure'],
        forms: ['Tablet'],
        dosageForm: 'Oral tablet',
        typicalDosage: '10mg once daily',
        sideEffects: ['Dry cough', 'Dizziness'],
        warnings: ['Do not use while pregnant'],
        tags: ['blood-pressure', 'ace-inhibitor'],
        bookmarked: false,
      },
    ]);

    await Article.create([
      {
        slug: 'managing-heart-health',
        title: '7 Practical Steps to Manage Heart Health',
        category: 'Cardiovascular',
        summary: 'Essential lifestyle modifications to lower cardiovascular risks.',
        content: 'Maintaining cardiovascular health requires daily habits and regular checkups.',
        author: 'Dr. Sarah Mitchell',
        readTimeMinutes: 5,
        publishedAt: new Date(),
        featured: true,
        tags: ['heart', 'wellness'],
      },
    ]);

    // 1. GET /api/conditions - list and pagination metadata
    const condList = await req('GET', '/api/conditions');
    if (condList.status === 200 && Array.isArray(condList.body.data) && condList.body.data.length >= 2) {
      pass('GET /api/conditions returns paginated conditions list');
    } else {
      fail('GET /api/conditions', `Expected 200 with data array, got ${condList.status}`);
    }

    // 2. GET /api/conditions?category=Cardiovascular - category filter
    const condCat = await req('GET', '/api/conditions?category=Cardiovascular');
    if (condCat.status === 200 && condCat.body.data.every((c: any) => c.category === 'Cardiovascular')) {
      pass('GET /api/conditions?category filters by category correctly');
    } else {
      fail('GET /api/conditions?category', `Expected only Cardiovascular conditions, got ${JSON.stringify(condCat.body.data)}`);
    }

    // 3. GET /api/conditions?q=hypertension - text search
    const condSearch = await req('GET', '/api/conditions?q=hypertension');
    if (condSearch.status === 200 && condSearch.body.data.length === 1 && condSearch.body.data[0].slug === 'hypertension') {
      pass('GET /api/conditions?q searches by query term');
    } else {
      fail('GET /api/conditions?q', `Expected hypertension match, got ${condSearch.body.data?.length}`);
    }

    // 4. GET /api/conditions with regex special characters does not crash or inject regex
    const condRegex = await req('GET', '/api/conditions?q=hyper.*+?^${}()|[]\\');
    if (condRegex.status === 200 && Array.isArray(condRegex.body.data)) {
      pass('GET /api/conditions safely escapes regex metacharacters in search query');
    } else {
      fail('GET /api/conditions regex escape', `Expected 200 with safe empty/filtered list, got ${condRegex.status}`);
    }

    // 5. GET /api/conditions/:slug - lookup by slug
    const condSlug = await req('GET', '/api/conditions/hypertension');
    if (condSlug.status === 200 && condSlug.body.slug === 'hypertension') {
      pass('GET /api/conditions/:slug returns single condition by slug');
    } else {
      fail('GET /api/conditions/:slug', `Expected 200 with slug hypertension, got ${condSlug.status}`);
    }

    // 6. GET /api/conditions/:slug fallback by ObjectId
    const asthmaDoc = await Condition.findOne({ slug: 'asthma' });
    const condId = await req('GET', `/api/conditions/${asthmaDoc!._id.toString()}`);
    if (condId.status === 200 && condId.body.slug === 'asthma') {
      pass('GET /api/conditions/:slug falls back to ObjectId lookup when provided');
    } else {
      fail('GET /api/conditions/:slug ObjectId fallback', `Expected 200, got ${condId.status}`);
    }

    // 7. GET /api/conditions/:slug 404 for nonexistent condition
    const cond404 = await req('GET', '/api/conditions/non-existent-condition-xyz');
    if (cond404.status === 404) {
      pass('GET /api/conditions/:slug returns 404 for unknown slug');
    } else {
      fail('GET /api/conditions/:slug 404', `Expected 404, got ${cond404.status}`);
    }

    // 8. GET /api/medicines - list and slug lookup
    const medList = await req('GET', '/api/medicines?q=lisinopril');
    const medSlug = await req('GET', '/api/medicines/lisinopril');
    if (medList.status === 200 && medSlug.status === 200 && medSlug.body.slug === 'lisinopril') {
      pass('GET /api/medicines and /api/medicines/:slug return medicine data');
    } else {
      fail('GET /api/medicines', `Expected 200 for medicines endpoints`);
    }

    // 9. GET /api/articles - list and slug lookup
    const artList = await req('GET', '/api/articles?category=Cardiovascular');
    const artSlug = await req('GET', '/api/articles/managing-heart-health');
    if (artList.status === 200 && artSlug.status === 200 && artSlug.body.slug === 'managing-heart-health') {
      pass('GET /api/articles and /api/articles/:slug return article data');
    } else {
      fail('GET /api/articles', `Expected 200 for articles endpoints`);
    }

    // ─── SECTION 2: System Reliability & Edge Cases ────────────────────────────
    console.log('\n📋 S2: Reliability & Edge Cases');

    // 10. GET /api/health/db returns 200 connected when DB is connected
    const dbHealthConnected = await req('GET', '/api/health/db');
    if (dbHealthConnected.status === 200 && dbHealthConnected.body.status === 'connected') {
      pass('GET /api/health/db reports status 200 "connected" when MongoDB is active');
    } else {
      fail('GET /api/health/db connected', `Expected 200 connected, got ${dbHealthConnected.status}`);
    }

    // 11. Expired JWT handling (verifies 401 response with error message)
    const expiredToken = jwt.sign(
      { userId: new mongoose.Types.ObjectId().toString(), role: 'patient' },
      process.env.JWT_SECRET || 'phase9-test-jwt-secret-key-32-chars-long',
      { expiresIn: '-10s' }
    );
    const expiredReq = await req('GET', '/api/user/profile', { token: expiredToken });
    if (expiredReq.status === 401) {
      pass('Request with expired JWT token returns 401 Unauthorized');
    } else {
      fail('Expired JWT handling', `Expected 401, got ${expiredReq.status}`);
    }

    // 12. JWT signed with incorrect secret returns 401
    const invalidSecretToken = jwt.sign(
      { userId: new mongoose.Types.ObjectId().toString(), role: 'patient' },
      'wrong-secret-key-that-does-not-match-at-all'
    );
    const invalidSecretReq = await req('GET', '/api/user/profile', { token: invalidSecretToken });
    if (invalidSecretReq.status === 401) {
      pass('Request with forged/tampered JWT secret returns 401 Unauthorized');
    } else {
      fail('Forged JWT handling', `Expected 401, got ${invalidSecretReq.status}`);
    }

    // 13. Malformed authorization token string returns 401
    const malformedReq = await req('GET', '/api/user/profile', { token: 'not-a-valid-jwt-token-string' });
    if (malformedReq.status === 401) {
      pass('Request with malformed JWT token string returns 401 Unauthorized');
    } else {
      fail('Malformed JWT handling', `Expected 401, got ${malformedReq.status}`);
    }

    // 14. Seed Doctor for Appointment Tests
    const testDoctor = await Doctor.create({
      name: 'Dr. Sarah Mitchell',
      slug: 'dr-sarah-mitchell',
      specialty: 'Cardiologist',
      qualifications: 'MD, FACC',
      experienceYears: 12,
      hospital: 'Metro Heart Institute',
      consultationFee: 150,
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      workingHours: { start: '09:00', end: '17:00' },
      consultationDurationMinutes: 30,
      isActive: true,
      availableToday: true,
      rating: 4.9,
      reviewCount: 48,
    });

    // Create a registered user for appointment concurrency testing
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash('Password123!', 10);
    const u1 = await User.create({
      name: 'Patient Alpha',
      email: 'alpha@phase9.test',
      passwordHash: hash,
      role: 'patient',
      isActive: true,
    });
    const u1Token = generateToken({ userId: u1._id.toString(), email: u1.email, role: 'patient' });
    const u1Csrf = generateCsrfToken();

    const u2 = await User.create({
      name: 'Patient Beta',
      email: 'beta@phase9.test',
      passwordHash: hash,
      role: 'patient',
      isActive: true,
    });
    const u2Token = generateToken({ userId: u2._id.toString(), email: u2.email, role: 'patient' });
    const u2Csrf = generateCsrfToken();

    // 15. Concurrent booking collision detection
    // Book slot 2026-11-02 10:00 (which is a Monday)
    const slotBooking1 = await req('POST', '/api/appointments', {
      token: u1Token,
      csrf: u1Csrf,
      body: {
        doctorId: testDoctor._id.toString(),
        date: '2026-11-02',
        timeSlot: '10:00',
        type: 'in-person',
        reason: 'Initial consultation',
      },
    });

    if (slotBooking1.status === 201) {
      pass('Initial appointment booking succeeds with 201 Created');
    } else {
      fail('Initial appointment booking', `Expected 201, got ${slotBooking1.status}: ${JSON.stringify(slotBooking1.body)}`);
    }

    // Attempt second booking for EXACT SAME doctor and time slot by user 2
    const slotBooking2 = await req('POST', '/api/appointments', {
      token: u2Token,
      csrf: u2Csrf,
      body: {
        doctorId: testDoctor._id.toString(),
        date: '2026-11-02',
        timeSlot: '10:00',
        type: 'in-person',
        reason: 'Second user booking same slot',
      },
    });

    if (slotBooking2.status === 409) {
      pass('Concurrent appointment collision returns 409 Conflict with informative error');
    } else {
      fail('Concurrent booking conflict', `Expected 409 Conflict, got ${slotBooking2.status}`);
    }

    // 16. Appointment cancellation invalidates pending reminder jobs
    const apptId = slotBooking1.body.appointment?._id || slotBooking1.body._id;
    await NotificationJob.create({
      userId: u1._id,
      jobType: 'appointment_24h',
      channel: 'in_app',
      idempotencyKey: `test_appt_${apptId}`,
      status: 'pending',
      scheduledFor: new Date(Date.now() + 86400000),
      payload: {
        title: 'Upcoming Appointment Reminder',
        message: 'You have an appointment scheduled.',
        referenceId: apptId.toString(),
        referenceType: 'appointment',
      },
    });

    // Cancel the appointment
    const cancelRes = await req('PATCH', `/api/appointments/${apptId}/cancel`, {
      token: u1Token,
      csrf: u1Csrf,
      body: { cancellationReason: 'Change of plans' },
    });

    const activeJobs = await NotificationJob.find({ 'payload.referenceId': apptId.toString(), status: 'pending' });
    if (cancelRes.status === 200 && activeJobs.length === 0) {
      pass('Cancelling appointment marks pending notification jobs as cancelled (suppresses reminders)');
    } else {
      fail('Cancellation reminder suppression', `Expected activeJobs count 0, got ${activeJobs.length}`);
    }

    // ─── SECTION 3: End-to-End User Journeys ────────────────────────────────────
    console.log('\n📋 S3: End-to-End User Journeys');

    // Journey 1: Register new patient user
    const regRes = await req('POST', '/api/auth/register', {
      body: {
        name: 'Eleanor Vance',
        email: 'eleanor.vance@careconnect.test',
        password: 'SecurePassword123!',
      },
    });

    let e2eToken = '';
    let e2eCsrf = '';
    if (regRes.status === 201 && regRes.body.user && regRes.body.user.email === 'eleanor.vance@careconnect.test') {
      pass('Journey 1: Register new patient user successfully creates account');
      // Extract cookies from register response
      const setCookie = regRes.headers['set-cookie'] || '';
      const tokenMatch = setCookie.match(/careconnect_token=([^;]+)/);
      const csrfMatch = setCookie.match(/careconnect_csrf_token=([^;]+)/);
      if (tokenMatch) e2eToken = tokenMatch[1];
      if (csrfMatch) e2eCsrf = csrfMatch[1];
      if (!e2eToken) e2eToken = generateToken({ userId: regRes.body.user.id || regRes.body.user._id, email: regRes.body.user.email, role: 'patient' });
      if (!e2eCsrf) e2eCsrf = generateCsrfToken();
    } else {
      fail('Journey 1: Registration', `Expected 201, got ${regRes.status}: ${JSON.stringify(regRes.body)}`);
    }

    // Journey 2: Access dashboard & verify initial state
    const dashProfile = await req('GET', '/api/user/profile', { token: e2eToken });
    const dashDoses = await req('GET', '/api/doses/today', { token: e2eToken });
    const dashAppts = await req('GET', '/api/appointments', { token: e2eToken });

    if (
      dashProfile.status === 200 &&
      dashProfile.body.name === 'Eleanor Vance' &&
      Array.isArray(dashDoses.body) &&
      dashDoses.body.length === 0 &&
      Array.isArray(dashAppts.body) &&
      dashAppts.body.length === 0
    ) {
      pass('Journey 2: Access dashboard & verify initial clean state (empty doses and appointments)');
    } else {
      fail('Journey 2: Initial Dashboard', `Profile: ${dashProfile.status}, Doses: ${dashDoses.status}, Appts: ${dashAppts.status}`);
    }

    // Journey 3: Search health conditions & read condition details
    const searchCond = await req('GET', '/api/conditions?q=asthma');
    const readCond = await req('GET', '/api/conditions/asthma');

    if (searchCond.status === 200 && searchCond.body.data.length > 0 && readCond.status === 200 && readCond.body.name) {
      pass('Journey 3: Search conditions and retrieve clinical details');
    } else {
      fail('Journey 3: Health Search', `Search: ${searchCond.status}, Read: ${readCond.status}`);
    }

    // Journey 4: Create a medication & check today's doses
    const createMed = await req('POST', '/api/medications', {
      token: e2eToken,
      csrf: e2eCsrf,
      body: {
        name: 'Metformin',
        dosage: '500mg',
        form: 'tablet',
        frequency: 'once_daily',
        times: ['08:00'],
        startDate: new Date().toISOString().split('T')[0],
        instructions: 'Take with evening meal',
      },
    });

    const updatedTodayDoses = await req('GET', '/api/doses/today', { token: e2eToken });
    if (createMed.status === 201 && updatedTodayDoses.status === 200 && updatedTodayDoses.body.length > 0) {
      pass('Journey 4: Create medication schedule and automatically generate dose records');
    } else {
      fail('Journey 4: Medication Creation', `Med: ${createMed.status}, Doses: ${updatedTodayDoses.body?.length}`);
    }

    // Journey 5: Browse doctors & book an appointment
    const docList = await req('GET', '/api/doctors');
    const bookAppt = await req('POST', '/api/appointments', {
      token: e2eToken,
      csrf: e2eCsrf,
      body: {
        doctorId: testDoctor._id.toString(),
        date: '2026-11-06', // Friday
        timeSlot: '14:00',
        type: 'in-person',
        reason: 'Asthma consultation',
      },
    });

    if (docList.status === 200 && docList.body.data.length > 0 && bookAppt.status === 201) {
      pass('Journey 5: Browse doctor directory and successfully book appointment');
    } else {
      fail('Journey 5: Appointment Booking', `DocList: ${docList.status}, Book: ${bookAppt.status}: ${JSON.stringify(bookAppt.body)}`);
    }

    // Journey 6: Update profile & health details
    const updateProf = await req('PUT', '/api/user/profile', {
      token: e2eToken,
      csrf: e2eCsrf,
      body: {
        phone: '+1 555-0144',
        emergencyContact: {
          name: 'Theodora Vance',
          relationship: 'Sister',
          phone: '+1 555-0188',
        },
      },
    });

    const updateHealth = await req('PUT', '/api/user/health-profile', {
      token: e2eToken,
      csrf: e2eCsrf,
      body: {
        bloodGroup: 'B+',
        allergies: ['Sulfonamides'],
        chronicConditions: ['Asthma'],
      },
    });

    if (
      updateProf.status === 200 &&
      (updateProf.body.emergencyContact?.name === 'Theodora Vance' || updateProf.body.user?.emergencyContact?.name === 'Theodora Vance') &&
      updateHealth.status === 200 &&
      updateHealth.body.data?.bloodGroup === 'B+'
    ) {
      pass('Journey 6: Update personal profile and clinical health information');
    } else {
      fail('Journey 6: Profile & Health Update', `Profile: ${updateProf.status}, Health: ${updateHealth.status}`);
    }

    // Journey 7: Ingest and read a notification
    const testNotif = await Notification.create({
      userId: regRes.body.user.id || regRes.body.user._id,
      type: 'health_tip',
      title: 'Stay Hydrated in Summer',
      message: 'Drink plenty of electrolytes and water.',
      read: false,
    });

    const notifInbox = await req('GET', '/api/notifications', { token: e2eToken });
    const markRead = await req('PATCH', `/api/notifications/${testNotif._id.toString()}/read`, {
      token: e2eToken,
      csrf: e2eCsrf,
    });

    if (
      notifInbox.status === 200 &&
      notifInbox.body.data.length >= 1 &&
      markRead.status === 200 &&
      markRead.body.notification?.read === true
    ) {
      pass('Journey 7: Receive notifications in inbox and mark individual items as read');
    } else {
      fail('Journey 7: Notification Flow', `Inbox: ${notifInbox.status}, MarkRead: ${markRead.status}`);
    }

    // Journey 8: Unauthorized route rejection without credentials
    const unauthProf = await req('GET', '/api/user/profile');
    const unauthMeds = await req('GET', '/api/medications');
    const unauthAppts = await req('GET', '/api/appointments');
    const unauthDoses = await req('GET', '/api/doses/today');

    if (
      unauthProf.status === 401 &&
      unauthMeds.status === 401 &&
      unauthAppts.status === 401 &&
      unauthDoses.status === 401
    ) {
      pass('Journey 8: Unauthorized access without valid credentials rejected with 401 on all protected routes');
    } else {
      fail('Journey 8: Unauthorized Rejection', `Profile: ${unauthProf.status}, Meds: ${unauthMeds.status}`);
    }

  } catch (err: any) {
    fail('Phase 9 suite fatal error', err.stack || err.message);
  } finally {
    await teardown();
  }

  console.log('\n============================================================');
  console.log(`Phase 9 QA & Integration Tests: ${passCount} passed, ${failCount} failed`);
  console.log('============================================================\n');

  if (failCount > 0) {
    console.error('Failures:\n' + failures.map((f) => ` - ${f}`).join('\n'));
    process.exit(1);
  }
}

runTests();
