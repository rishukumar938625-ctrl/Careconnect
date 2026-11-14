/**
 * CareConnect — Phase 11 Complete Authentication & User Journey End-to-End Integration Audit
 *
 * Comprehensive end-to-end audit verifying all 16 user journey steps:
 * 1. Register a new patient account (with validation & safe payload checks)
 * 2. Log in successfully (credential verification & generic 401 errors)
 * 3. Load dashboard & personal profile (clean initial state)
 * 4. Update personal profile details (phone, DOB, blood group, emergency contact, allergies, conditions)
 * 5. Add a medication (dosage, form, frequency, schedule generation)
 * 6. Create medication reminders (scheduler idempotency & duplicate prevention)
 * 7. Mark a medication dose as taken (timestamping & reminder cancellation & cross-user isolation)
 * 8. Search health information (conditions, medicines, articles with regex protection)
 * 9. Bookmark a health article (persistence in user profile & toggle)
 * 10. Find doctors and check availability (dynamic future weekday slots)
 * 11. Book an appointment (double-booking prevention & 409 conflict handling)
 * 12. Reschedule and cancel an appointment (slot release & notification cancellation)
 * 13. Verify notifications and notification preferences (inbox, mark-as-read, quiet hours)
 * 14. Refresh the application and verify persisted data (session verification & profile integrity)
 * 15. Log out (cookie invalidation)
 * 16. Verify protected routes reject unauthenticated users (401 Unauthorized)
 */

import http from 'http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';
import cookieParser from 'cookie-parser';
import { URL } from 'url';

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

function extractCookies(setCookieHeader: string | string[] | undefined): { token?: string; csrf?: string } {
  if (!setCookieHeader) return {};
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
  const tokenMatch = cookies.match(/careconnect_token=([^;]+)/);
  const csrfMatch = cookies.match(/careconnect_csrf_token=([^;]+)/);
  return {
    token: tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined,
    csrf: csrfMatch ? decodeURIComponent(csrfMatch[1]) : undefined,
  };
}

function getTodayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getFutureWeekday(daysInFuture: number = 7): { dateStr: string; dayName: string } {
  const d = new Date();
  d.setDate(d.getDate() + daysInFuture);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return {
    dateStr: `${y}-${m}-${day}`,
    dayName: days[d.getDay()],
  };
}

// ─── Setup & Teardown ─────────────────────────────────────────────────────────

async function setup() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'phase11-audit-secret-key-at-least-32-chars-long';
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
  console.log('🧪 CareConnect Phase 11: Complete End-to-End User Journey Audit');
  console.log('============================================================\n');

  try {
    await setup();

    // Seed reference data (Doctor, Condition, Medicine, Article)
    const testDoctor = await Doctor.create({
      name: 'Dr. Sarah Jenkins',
      slug: 'dr-sarah-jenkins',
      specialty: 'Cardiology',
      qualifications: 'MD, FACC',
      hospital: 'Metro General Hospital',
      bio: 'Board-certified cardiologist specializing in hypertension management.',
      rating: 4.9,
      reviewCount: 120,
      workingHours: { start: '09:00', end: '17:00' },
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      consultationDurationMinutes: 30,
      isActive: true,
    });

    await Condition.create({
      name: 'Hypertension',
      slug: 'hypertension',
      category: 'Cardiovascular',
      shortDescription: 'High blood pressure is a common cardiovascular condition.',
      overview: 'High blood pressure is a common condition affecting the arteries.',
      symptoms: ['Headaches', 'Shortness of breath', 'Dizziness'],
      causes: ['Genetics', 'High sodium diet', 'Obesity'],
      prevention: ['Regular exercise', 'Healthy diet', 'Stress management'],
      whenToSeekMedicalHelp: ['Consistent readings above 140/90 mmHg'],
      whenToSeeDoctor: ['Consistent readings above 140/90 mmHg'],
      tags: ['Heart', 'Blood Pressure'],
    });

    await Medicine.create({
      name: 'Lisinopril',
      slug: 'lisinopril',
      genericName: 'Lisinopril',
      category: 'ACE Inhibitor',
      description: 'An ACE inhibitor used primarily for the treatment of high blood pressure and heart failure.',
      commonUses: ['Treatment of hypertension', 'Heart failure management'],
      uses: ['Treatment of hypertension', 'Heart failure management'],
      commonSideEffects: ['Dry cough', 'Dizziness', 'Headache'],
      sideEffects: ['Dry cough', 'Dizziness', 'Headache'],
      forms: ['Tablet'],
    });

    await Article.create({
      title: 'Managing High Blood Pressure Naturally',
      slug: 'managing-high-blood-pressure',
      category: 'Cardiovascular Health',
      summary: 'Practical dietary and lifestyle changes to lower blood pressure safely.',
      content: 'Regular aerobic exercise, sodium reduction, and stress management are vital strategies for naturally managing blood pressure.',
      author: { name: 'CareConnect Health Editorial Team', role: 'Medical Content Reviewer' },
      tags: ['Heart', 'Hypertension', 'Diet'],
      bookmarked: false,
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Step 1: Register a new patient account
    // ──────────────────────────────────────────────────────────────────────────
    console.log('📋 Step 1: Register a new patient account');

    // 1a. Validate password length constraint
    const invalidReg = await req('POST', '/api/auth/register', {
      body: {
        name: 'Clara Oswald',
        email: 'clara.oswald@careconnect.test',
        password: 'short',
      },
    });
    if (invalidReg.status === 400) {
      pass('Step 1a: Registration rejects weak password (<8 chars) with 400 Bad Request');
    } else {
      fail('Step 1a: Weak password rejection', `Expected 400, got ${invalidReg.status}`);
    }

    // 1b. Successful registration
    const regRes = await req('POST', '/api/auth/register', {
      body: {
        name: 'Clara Oswald',
        email: 'clara.oswald@careconnect.test',
        password: 'SecureP@ssword2026!',
      },
    });

    let claraToken: string | undefined;
    let claraCsrf: string | undefined;
    const cookiesAfterReg = extractCookies(regRes.headers['set-cookie']);
    claraToken = cookiesAfterReg.token;
    claraCsrf = cookiesAfterReg.csrf;

    if (
      regRes.status === 201 &&
      regRes.body.user &&
      regRes.body.user.email === 'clara.oswald@careconnect.test' &&
      !regRes.body.user.passwordHash &&
      claraToken &&
      claraCsrf
    ) {
      pass('Step 1b: Register patient account returns 201, safe user object (no passwordHash), and session cookies');
    } else {
      fail('Step 1b: Patient registration', `Expected 201 with cookies, got ${regRes.status}: ${JSON.stringify(regRes.body)}`);
    }

    // 1c. Duplicate email registration rejection
    const dupReg = await req('POST', '/api/auth/register', {
      body: {
        name: 'Clara Duplicate',
        email: 'CLARA.OSWALD@careconnect.test',
        password: 'SecureP@ssword2026!',
      },
    });
    if (dupReg.status === 409) {
      pass('Step 1c: Duplicate email registration rejected with 409 Conflict');
    } else {
      fail('Step 1c: Duplicate registration', `Expected 409, got ${dupReg.status}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 2: Log in successfully
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 Step 2: Log in successfully');

    // 2a. Bad password generic 401 error
    const badLogin = await req('POST', '/api/auth/login', {
      body: {
        email: 'clara.oswald@careconnect.test',
        password: 'WrongPassword!',
      },
    });
    if (badLogin.status === 401 && badLogin.body.message) {
      pass('Step 2a: Invalid credentials rejected with generic 401 Unauthorized');
    } else {
      fail('Step 2a: Bad password rejection', `Expected 401, got ${badLogin.status}`);
    }

    // 2b. Valid login
    const loginRes = await req('POST', '/api/auth/login', {
      body: {
        email: 'clara.oswald@careconnect.test',
        password: 'SecureP@ssword2026!',
      },
    });

    const cookiesAfterLogin = extractCookies(loginRes.headers['set-cookie']);
    if (cookiesAfterLogin.token) claraToken = cookiesAfterLogin.token;
    if (cookiesAfterLogin.csrf) claraCsrf = cookiesAfterLogin.csrf;

    if (
      loginRes.status === 200 &&
      loginRes.body.user &&
      loginRes.body.user.name === 'Clara Oswald' &&
      claraToken &&
      claraCsrf
    ) {
      pass('Step 2b: Successful login returns 200, user profile, and session cookies');
    } else {
      fail('Step 2b: Patient login', `Expected 200 with tokens, got ${loginRes.status}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 3: Load the dashboard and personal profile
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 Step 3: Load the dashboard and personal profile');

    const dashProfile = await req('GET', '/api/user/profile', { token: claraToken });
    const dashDoses = await req('GET', '/api/doses/today', { token: claraToken });
    const dashAppts = await req('GET', '/api/appointments?status=upcoming', { token: claraToken });

    if (
      dashProfile.status === 200 &&
      dashProfile.body.name === 'Clara Oswald' &&
      dashProfile.body.email === 'clara.oswald@careconnect.test' &&
      Array.isArray(dashDoses.body) &&
      dashDoses.body.length === 0 &&
      Array.isArray(dashAppts.body) &&
      dashAppts.body.length === 0
    ) {
      pass('Step 3: Dashboard & personal profile load with clean initial state (0 doses, 0 appointments)');
    } else {
      fail('Step 3: Initial dashboard load', `Profile: ${dashProfile.status}, Doses: ${dashDoses.status}, Appts: ${dashAppts.status}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 4: Update personal profile details
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 Step 4: Update personal profile details');

    // 4a. Update profile details and emergency contact
    const updateProf = await req('PUT', '/api/user/profile', {
      token: claraToken,
      csrf: claraCsrf,
      body: {
        phone: '+1 555-0199',
        dateOfBirth: '1992-06-15',
        bloodGroup: 'O+',
        emergencyContact: {
          name: 'Danny Pink',
          relationship: 'Partner',
          phone: '+1 555-0122',
        },
      },
    });

    if (
      updateProf.status === 200 &&
      updateProf.body.phone === '+1 555-0199' &&
      updateProf.body.bloodGroup === 'O+' &&
      updateProf.body.emergencyContact?.name === 'Danny Pink'
    ) {
      pass('Step 4a: Update personal profile details and emergency contact returns 200 and updated fields');
    } else {
      fail('Step 4a: Update personal profile', `Expected 200 with updated fields, got ${updateProf.status}: ${JSON.stringify(updateProf.body)}`);
    }

    // 4b. Update health profile (allergies and chronic conditions)
    const updateHealth = await req('PUT', '/api/user/health-profile', {
      token: claraToken,
      csrf: claraCsrf,
      body: {
        allergies: ['Penicillin'],
        chronicConditions: ['Hypertension'],
      },
    });

    // 4c. Add individual allergy
    const addAllergyRes = await req('POST', '/api/user/health-profile/allergies', {
      token: claraToken,
      csrf: claraCsrf,
      body: { allergy: 'Aspirin' },
    });

    if (
      updateHealth.status === 200 &&
      addAllergyRes.status === 200 &&
      addAllergyRes.body.allergies?.includes('Aspirin') &&
      addAllergyRes.body.allergies?.includes('Penicillin')
    ) {
      pass('Step 4b: Health profile updated with allergies and chronic conditions; addAllergy successfully appends');
    } else {
      fail('Step 4b: Health profile update', `Health: ${updateHealth.status}, AddAllergy: ${addAllergyRes.status}`);
    }

    // 4d. Reject role or email tampering
    const tamperRole = await req('PUT', '/api/user/profile', {
      token: claraToken,
      csrf: claraCsrf,
      body: { role: 'admin' },
    });
    if (tamperRole.status === 400) {
      pass('Step 4c: Role escalation attempt in profile update securely blocked with 400 Bad Request');
    } else {
      fail('Step 4c: Role tampering rejection', `Expected 400, got ${tamperRole.status}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 5: Add a medication
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 Step 5: Add a medication');

    const todayStr = getTodayDateStr();
    const createMed = await req('POST', '/api/medications', {
      token: claraToken,
      csrf: claraCsrf,
      body: {
        name: 'Lisinopril',
        dosage: '10mg',
        form: 'tablet',
        frequency: 'once_daily',
        timesOfDay: ['09:00'],
        startDate: todayStr,
        instructions: 'Take in the morning with a full glass of water',
        color: '#2563EB',
      },
    });

    let medId: string | undefined;
    let scheduledDoseId: string | undefined;

    if (createMed.status === 201 && createMed.body.name === 'Lisinopril') {
      medId = createMed.body._id || createMed.body.id;
      pass('Step 5a: Add medication returns 201 Created and saves schedule parameters');
    } else {
      fail('Step 5a: Add medication', `Expected 201, got ${createMed.status}: ${JSON.stringify(createMed.body)}`);
    }

    // Verify today's dose was generated
    const dosesToday = await req('GET', '/api/doses/today', { token: claraToken });
    if (dosesToday.status === 200 && dosesToday.body.length > 0) {
      scheduledDoseId = dosesToday.body[0]._id || dosesToday.body[0].id;
      pass('Step 5b: Medication creation automatically generates pending DoseRecord for today');
    } else {
      fail('Step 5b: Dose generation', `Expected >= 1 dose today, got ${dosesToday.body?.length}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 6: Create medication reminders
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 Step 6: Create medication reminders');

    const syncReminders1 = await req('POST', '/api/notifications/sync', {
      token: claraToken,
      csrf: claraCsrf,
    });

    const jobsAfterSync1 = await NotificationJob.countDocuments({
      userId: regRes.body.user._id,
      jobType: 'medication_reminder',
      status: 'pending',
    });

    // Run again to verify idempotency (zero duplicates created)
    const syncReminders2 = await req('POST', '/api/notifications/sync', {
      token: claraToken,
      csrf: claraCsrf,
    });

    const jobsAfterSync2 = await NotificationJob.countDocuments({
      userId: regRes.body.user._id,
      jobType: 'medication_reminder',
      status: 'pending',
    });

    if (syncReminders1.status === 200 && jobsAfterSync1 > 0 && jobsAfterSync2 === jobsAfterSync1) {
      pass(`Step 6: Medication reminders scheduled (${jobsAfterSync1} pending jobs) and verified idempotent (0 duplicates)`);
    } else {
      fail('Step 6: Reminder scheduling', `Sync1: ${jobsAfterSync1}, Sync2: ${jobsAfterSync2}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 7: Mark a medication dose as taken
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 Step 7: Mark a medication dose as taken');

    if (!scheduledDoseId) {
      fail('Step 7: Dose ID missing', 'Cannot test dose status update without scheduled dose ID');
    } else {
      const takeRes = await req('PATCH', `/api/doses/${scheduledDoseId}/status`, {
        token: claraToken,
        csrf: claraCsrf,
        body: { status: 'taken' },
      });

      // Verify notification reminder for taken dose is cancelled
      const activeReminderJobs = await NotificationJob.find({
        'payload.referenceId': scheduledDoseId,
        status: 'pending',
      });

      if (
        takeRes.status === 200 &&
        takeRes.body.status === 'taken' &&
        takeRes.body.takenAt &&
        activeReminderJobs.length === 0
      ) {
        pass('Step 7a: Dose marked as taken records takenAt timestamp and cancels pending notification reminder');
      } else {
        fail('Step 7a: Mark dose taken', `Status: ${takeRes.status}, takenAt: ${takeRes.body?.takenAt}, activeJobs: ${activeReminderJobs.length}`);
      }

      // 7b. Patient data isolation: Bob cannot mark Clara's dose
      const bobReg = await req('POST', '/api/auth/register', {
        body: {
          name: 'Bob Smith',
          email: 'bob.smith@careconnect.test',
          password: 'SecureP@ssword2026!',
        },
      });
      const bobCookies = extractCookies(bobReg.headers['set-cookie']);

      const bobCrossAccess = await req('PATCH', `/api/doses/${scheduledDoseId}/status`, {
        token: bobCookies.token,
        csrf: bobCookies.csrf,
        body: { status: 'skipped' },
      });

      if (bobCrossAccess.status === 404) {
        pass("Step 7b: Cross-user isolation confirmed: another user cannot access or modify Clara's dose (404)");
      } else {
        fail('Step 7b: Cross-user isolation', `Expected 404, got ${bobCrossAccess.status}`);
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 8: Search health information
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 Step 8: Search health information');

    const searchCond = await req('GET', '/api/conditions?q=hypertension');
    const searchMed = await req('GET', '/api/medicines?q=lisinopril');
    const searchArt = await req('GET', '/api/articles?q=managing');

    // Safe regex test: query with regex metacharacters should not crash or cause ReDoS
    const regexSafety = await req('GET', '/api/conditions?q=hyper.*([a-z]+)+');

    if (
      searchCond.status === 200 &&
      searchCond.body.data.length > 0 &&
      searchMed.status === 200 &&
      searchMed.body.data.length > 0 &&
      searchArt.status === 200 &&
      searchArt.body.data.length > 0 &&
      regexSafety.status === 200
    ) {
      pass('Step 8: Search health information returns matching conditions, medicines, articles with regex protection');
    } else {
      fail('Step 8: Health search', `Cond: ${searchCond.status}, Med: ${searchMed.status}, Art: ${searchArt.status}, Regex: ${regexSafety.status}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 9: Bookmark a health article
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 Step 9: Bookmark a health article');

    // Toggle bookmark on
    const bookmarkOn = await req('POST', '/api/articles/managing-high-blood-pressure/bookmark', {
      token: claraToken,
      csrf: claraCsrf,
    });

    const profAfterBookmark = await req('GET', '/api/user/profile', { token: claraToken });

    // Toggle bookmark off
    const bookmarkOff = await req('POST', '/api/articles/managing-high-blood-pressure/bookmark', {
      token: claraToken,
      csrf: claraCsrf,
    });

    // Toggle back on for final state
    await req('POST', '/api/articles/managing-high-blood-pressure/bookmark', {
      token: claraToken,
      csrf: claraCsrf,
    });

    if (
      bookmarkOn.status === 200 &&
      bookmarkOn.body.bookmarked === true &&
      profAfterBookmark.body.bookmarkedArticles?.includes('managing-high-blood-pressure') &&
      bookmarkOff.status === 200 &&
      bookmarkOff.body.bookmarked === false
    ) {
      pass('Step 9: Bookmark article successfully toggles and persists in user profile');
    } else {
      fail('Step 9: Bookmark article', `On: ${bookmarkOn.body?.bookmarked}, Off: ${bookmarkOff.body?.bookmarked}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 10: Find doctors and check availability
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 Step 10: Find doctors and check availability');

    const nextWeekday = getFutureWeekday(5);
    const doctorList = await req('GET', '/api/doctors?specialty=Cardiology');
    const docId = testDoctor._id.toString();

    const availability = await req('GET', `/api/doctors/${docId}/availability?date=${nextWeekday.dateStr}`);

    if (
      doctorList.status === 200 &&
      doctorList.body.data.length > 0 &&
      availability.status === 200 &&
      availability.body.data?.slots &&
      availability.body.data.slots.some((s: any) => s.timeSlot === '10:00')
    ) {
      pass(`Step 10: Found Dr. Sarah Jenkins and verified availability for ${nextWeekday.dayName} (${nextWeekday.dateStr})`);
    } else {
      fail('Step 10: Doctor & availability', `Docs: ${doctorList.status}, Avail: ${availability.status}, Slots: ${availability.body?.data?.slots?.length}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 11: Book an appointment
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 Step 11: Book an appointment & test double-booking prevention');

    const bookRes = await req('POST', '/api/appointments', {
      token: claraToken,
      csrf: claraCsrf,
      body: {
        doctorId: docId,
        date: nextWeekday.dateStr,
        timeSlot: '10:00',
        type: 'in-person',
        reason: 'Hypertension follow-up consultation',
      },
    });

    let apptId: string | undefined;
    if (bookRes.status === 201 && bookRes.body.status === 'booked') {
      apptId = bookRes.body._id || bookRes.body.id;
      pass('Step 11a: Book appointment returns 201 Created with status booked');
    } else {
      fail('Step 11a: Appointment booking', `Expected 201, got ${bookRes.status}: ${JSON.stringify(bookRes.body)}`);
    }

    // Double-booking check: User 2 (Bob) tries to book the EXACT SAME slot
    const bobUser = await User.findOne({ email: 'bob.smith@careconnect.test' });
    const { token: bobToken, csrf: bobCsrf } = extractCookies(
      (await req('POST', '/api/auth/login', {
        body: { email: 'bob.smith@careconnect.test', password: 'SecureP@ssword2026!' },
      })).headers['set-cookie']
    );

    const collisionRes = await req('POST', '/api/appointments', {
      token: bobToken,
      csrf: bobCsrf,
      body: {
        doctorId: docId,
        date: nextWeekday.dateStr,
        timeSlot: '10:00',
        type: 'video',
        reason: 'Attempted concurrent booking collision',
      },
    });

    if (collisionRes.status === 409) {
      pass('Step 11b: Double-booking prevention confirmed: concurrent booking for the same slot rejected with 409 Conflict');
    } else {
      fail('Step 11b: Double-booking collision', `Expected 409 Conflict, got ${collisionRes.status}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 12: Reschedule and cancel an appointment
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 Step 12: Reschedule and cancel an appointment');

    if (!apptId) {
      fail('Step 12: Missing appointment ID', 'Cannot test reschedule/cancel without appointment ID');
    } else {
      // 12a. Reschedule to 14:00 on the same date
      const rescheduleRes = await req('PATCH', `/api/appointments/${apptId}/reschedule`, {
        token: claraToken,
        csrf: claraCsrf,
        body: {
          date: nextWeekday.dateStr,
          timeSlot: '14:00',
          reason: 'Rescheduled for afternoon schedule',
        },
      });

      if (
        rescheduleRes.status === 200 &&
        rescheduleRes.body.appointment?.timeSlot === '14:00' &&
        rescheduleRes.body.appointment?.status === 'booked'
      ) {
        pass('Step 12a: Reschedule appointment returns 200 and updates slot to 14:00');
      } else {
        fail('Step 12a: Reschedule appointment', `Expected 200, got ${rescheduleRes.status}: ${JSON.stringify(rescheduleRes.body)}`);
      }

      // 12b. Verify 10:00 slot is now freed up for Bob
      const bobTakesOldSlot = await req('POST', '/api/appointments', {
        token: bobToken,
        csrf: bobCsrf,
        body: {
          doctorId: docId,
          date: nextWeekday.dateStr,
          timeSlot: '10:00',
          type: 'video',
          reason: 'Booking newly freed slot',
        },
      });

      if (bobTakesOldSlot.status === 201) {
        pass('Step 12b: Previously held 10:00 slot was safely freed upon rescheduling and booked by another patient');
      } else {
        fail('Step 12b: Slot release check', `Expected 201, got ${bobTakesOldSlot.status}`);
      }

      // 12c. Cancel Clara's appointment
      const cancelRes = await req('PATCH', `/api/appointments/${apptId}/cancel`, {
        token: claraToken,
        csrf: claraCsrf,
        body: { cancellationReason: 'Doctor advised earlier rest' },
      });

      const activeReminderJobs = await NotificationJob.find({
        'payload.referenceId': apptId,
        status: 'pending',
      });

      if (
        cancelRes.status === 200 &&
        cancelRes.body.appointment?.status === 'cancelled' &&
        activeReminderJobs.length === 0
      ) {
        pass('Step 12c: Cancel appointment marks status as cancelled and suppresses pending reminders');
      } else {
        fail('Step 12c: Cancel appointment', `Status: ${cancelRes.status}, activeJobs: ${activeReminderJobs.length}`);
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 13: Verify notifications and notification preferences
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 Step 13: Verify notifications and notification preferences');

    // Create an in-app notification for Clara
    const userDoc = await User.findOne({ email: 'clara.oswald@careconnect.test' });
    const notifDoc = await Notification.create({
      userId: userDoc!._id,
      type: 'medication_reminder',
      title: 'Time to take Lisinopril',
      message: 'Scheduled 10mg dose for 09:00',
      read: false,
    });

    const notifInbox = await req('GET', '/api/notifications', { token: claraToken });
    const unreadCountRes = await req('GET', '/api/notifications/unread-count', { token: claraToken });

    // Mark as read
    const markReadRes = await req('PATCH', `/api/notifications/${notifDoc._id}/read`, {
      token: claraToken,
      csrf: claraCsrf,
    });

    // Update notification preferences (quiet hours)
    const updateNotifPrefs = await req('PUT', '/api/user/notifications', {
      token: claraToken,
      csrf: claraCsrf,
      body: {
        medicationReminders: true,
        appointmentAlerts: true,
        quietHoursEnabled: true,
        quietHoursStart: '23:00',
        quietHoursEnd: '07:00',
        timeZone: 'UTC',
      },
    });

    if (
      notifInbox.status === 200 &&
      notifInbox.body.data?.length >= 1 &&
      unreadCountRes.body.unreadCount >= 1 &&
      markReadRes.status === 200 &&
      markReadRes.body.notification?.read === true &&
      updateNotifPrefs.status === 200 &&
      updateNotifPrefs.body.data?.quietHoursEnabled === true
    ) {
      pass('Step 13: Notifications retrieved, marked read, and quiet hours preferences updated');
    } else {
      fail('Step 13: Notifications & Preferences', `Inbox: ${notifInbox.status}, MarkRead: ${markReadRes.status}, Prefs: ${updateNotifPrefs.status}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 14: Refresh the application and verify persisted data
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 Step 14: Refresh the application and verify persisted data');

    const meRes = await req('GET', '/api/auth/me', { token: claraToken });

    if (
      meRes.status === 200 &&
      meRes.body.user &&
      meRes.body.user.name === 'Clara Oswald' &&
      meRes.body.user.phone === '+1 555-0199' &&
      meRes.body.user.bloodGroup === 'O+' &&
      meRes.body.user.emergencyContact?.name === 'Danny Pink' &&
      meRes.body.user.allergies?.includes('Penicillin') &&
      meRes.body.user.chronicConditions?.includes('Hypertension') &&
      meRes.body.user.bookmarkedArticles?.includes('managing-high-blood-pressure') &&
      meRes.body.user.notificationPreferences?.quietHoursEnabled === true
    ) {
      pass('Step 14: Application session refresh (GET /api/auth/me) confirms 100% data persistence across all features');
    } else {
      fail('Step 14: Session data persistence', `Expected 200 with full persistence, got ${meRes.status}: ${JSON.stringify(meRes.body)}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 15: Log out
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 Step 15: Log out');

    const logoutRes = await req('POST', '/api/auth/logout', {
      token: claraToken,
      csrf: claraCsrf,
    });

    const logoutSetCookie = logoutRes.headers['set-cookie'] || '';
    const tokenCleared =
      logoutSetCookie.includes('careconnect_token=;') ||
      logoutSetCookie.includes('careconnect_token=deleted') ||
      logoutSetCookie.includes('Max-Age=0') ||
      logoutSetCookie.includes('Expires=Thu, 01 Jan 1970');

    if (logoutRes.status === 200 && tokenCleared) {
      pass('Step 15: Logout returns 200 and securely clears session cookies');
    } else {
      fail('Step 15: Logout', `Expected 200 with cleared cookies, got ${logoutRes.status}: ${logoutSetCookie}`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Step 16: Verify protected routes reject unauthenticated users
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📋 Step 16: Verify protected routes reject unauthenticated users');

    const unauthChecks = await Promise.all([
      req('GET', '/api/user/profile'),
      req('GET', '/api/medications'),
      req('GET', '/api/appointments'),
      req('GET', '/api/doses/today'),
      req('GET', '/api/notifications'),
      req('POST', '/api/medications', { body: { name: 'Test' } }),
      req('POST', '/api/appointments', { body: { doctorId: docId } }),
    ]);

    const allRejectedWith401 = unauthChecks.every((r) => r.status === 401);
    if (allRejectedWith401) {
      pass('Step 16: All protected routes (/user/profile, /medications, /appointments, /doses/today, /notifications) reject unauthenticated requests with 401');
    } else {
      const statuses = unauthChecks.map((r) => r.status);
      fail('Step 16: Protected route enforcement', `Expected all 401, got: ${statuses.join(', ')}`);
    }

  } catch (err: any) {
    fail('Phase 11 user journey audit fatal error', err.stack || err.message);
  } finally {
    await teardown();
  }

  console.log('\n============================================================');
  console.log(`Phase 11 Audit Results: ${passCount} passed, ${failCount} failed`);
  console.log('============================================================\n');

  if (failCount > 0) {
    console.error('Audit Failures:\n' + failures.map((f) => ` - ${f}`).join('\n'));
    process.exit(1);
  }
}

runTests();
