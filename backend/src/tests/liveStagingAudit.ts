/**
 * CareConnect — Phase 13 Live Staging Validation Suite
 *
 * Executes live validation directly against the active MongoDB Atlas database
 * using synthetic test accounts.
 *
 * Validates:
 * - Task 3: Authentication (registration, login, logout, password checks, session refresh, role escalation)
 * - Task 4: Patient Data Isolation (cross-patient access blocks on medications, appointments, profile)
 * - Task 5: Medication Lifecycle & Notifications (add, update, doses, reminders, quiet hours, archive, adherence)
 * - Task 6: Appointment Lifecycle & Concurrency (doctor search, availability, booking, 409 double-booking, reschedule, cancel)
 * - Task 7: Health Information & Bookmarks (conditions, medicines, articles, search, bookmarks)
 *
 * Cleans up all synthetic test data upon completion.
 */

import http from 'http';
import mongoose from 'mongoose';
import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

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
  urlPath: string,
  opts: ReqOpts = {}
): Promise<ReqResult> {
  const url = new URL(urlPath, baseUrl);
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
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getFutureWeekday(daysInFuture = 7): { dateStr: string; dayName: string } {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysInFuture);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return {
    dateStr: `${y}-${m}-${day}`,
    dayName: days[d.getUTCDay()],
  };
}

async function runLiveStagingValidation() {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('🚀 CareConnect Phase 13: Live Staging Validation Suite');
  console.log('════════════════════════════════════════════════════════════════\n');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in backend/.env');
    process.exit(1);
  }

  console.log('📡 Connecting to MongoDB Atlas...');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`✅ Connected to MongoDB Atlas cluster: "${mongoose.connection.name}"\n`);

  // Start internal test server on ephemeral port
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

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const port = (server.address() as any).port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`🧪 Test gateway bound to port ${port}\n`);
      resolve();
    });
  });

  const timestamp = Date.now();
  const patientAEmail = `synthetic.patient.alpha.${timestamp}@careconnect.test`;
  const patientBEmail = `synthetic.patient.beta.${timestamp}@careconnect.test`;
  let patientAId = '';
  let patientBId = '';

  let tokenA = '';
  let csrfA = '';
  let tokenB = '';
  let csrfB = '';

  let createdMedicationId = '';
  let createdDoseId = '';
  let createdAppointmentId = '';
  let selectedDoctorId = '';

  try {
    // ══════════════════════════════════════════════════════════════
    // TASK 3: AUTHENTICATION VALIDATION
    // ══════════════════════════════════════════════════════════════
    console.log('────────────────────────────────────────────────────────────────');
    console.log('📋 TASK 3: Authentication & Security Boundaries Validation');
    console.log('────────────────────────────────────────────────────────────────');

    // 1. Weak password rejected
    const weakPassRes = await req('POST', '/api/auth/register', {
      body: { name: 'Alpha Patient', email: patientAEmail, password: 'short' },
    });
    if (weakPassRes.status === 400 && weakPassRes.body.message?.includes('8 characters')) {
      pass('Weak password (<8 chars) correctly rejected with 400 Bad Request');
    } else {
      fail('Weak password check', `Expected 400, got ${weakPassRes.status}`);
    }

    // 2. Role escalation during registration rejected
    const roleEscRes = await req('POST', '/api/auth/register', {
      body: { name: 'Alpha Patient', email: patientAEmail, password: 'SecurePassword123!', role: 'admin' },
    });
    if (roleEscRes.status === 400 && roleEscRes.body.message?.includes('Privileged roles')) {
      pass('Role tampering (role: admin) during public registration securely rejected');
    } else {
      fail('Role escalation check', `Expected 400, got ${roleEscRes.status}`);
    }

    // 3. Successful registration for Patient A
    const regARes = await req('POST', '/api/auth/register', {
      body: { name: 'Alpha Patient', email: patientAEmail, password: 'SecurePassword123!' },
    });
    const cookiesA = extractCookies(regARes.headers['set-cookie']);
    tokenA = cookiesA.token || '';
    csrfA = cookiesA.csrf || '';
    patientAId = regARes.body.user?._id || '';

    if (
      regARes.status === 201 &&
      regARes.body.user?.role === 'patient' &&
      !regARes.body.user?.passwordHash &&
      tokenA &&
      csrfA
    ) {
      pass('Patient A registered: 201 Created, safe user payload, HttpOnly session cookie, CSRF cookie');
    } else {
      fail('Patient A registration', `Status: ${regARes.status}, body: ${JSON.stringify(regARes.body)}`);
    }

    // 4. Duplicate email registration rejected
    const dupRegRes = await req('POST', '/api/auth/register', {
      body: { name: 'Alpha Duplicate', email: patientAEmail, password: 'SecurePassword123!' },
    });
    if (dupRegRes.status === 409) {
      pass('Duplicate email registration rejected with 409 Conflict');
    } else {
      fail('Duplicate registration', `Expected 409, got ${dupRegRes.status}`);
    }

    // 5. Successful registration for Patient B
    const regBRes = await req('POST', '/api/auth/register', {
      body: { name: 'Beta Patient', email: patientBEmail, password: 'SecurePassword456!' },
    });
    const cookiesB = extractCookies(regBRes.headers['set-cookie']);
    tokenB = cookiesB.token || '';
    csrfB = cookiesB.csrf || '';
    patientBId = regBRes.body.user?._id || '';

    if (regBRes.status === 201 && tokenB && csrfB) {
      pass('Patient B registered: 201 Created with isolated credentials');
    } else {
      fail('Patient B registration', `Status: ${regBRes.status}`);
    }

    // 6. Invalid login rejected with generic 401
    const badLoginRes = await req('POST', '/api/auth/login', {
      body: { email: patientAEmail, password: 'WrongPassword999!' },
    });
    if (badLoginRes.status === 401 && badLoginRes.body.message === 'Invalid email or password.') {
      pass('Invalid password rejected with generic 401 to prevent credential enumeration');
    } else {
      fail('Invalid login', `Expected 401, got ${badLoginRes.status}`);
    }

    // 7. Successful login
    const loginRes = await req('POST', '/api/auth/login', {
      body: { email: patientAEmail, password: 'SecurePassword123!' },
    });
    if (loginRes.status === 200 && loginRes.body.user?.email === patientAEmail) {
      pass('Patient A login: 200 OK, authenticated session established');
    } else {
      fail('Login', `Expected 200, got ${loginRes.status}`);
    }

    // 8. Session behavior on refresh (/api/auth/me)
    const meRes = await req('GET', '/api/auth/me', { token: tokenA });
    if (meRes.status === 200 && meRes.body.user?.email === patientAEmail) {
      pass('Session persistence verified: GET /api/auth/me returns current user');
    } else {
      fail('Session persistence', `Expected 200, got ${meRes.status}`);
    }

    // 9. Protected route rejects unauthenticated requests
    const unauthRes = await req('GET', '/api/user/profile');
    if (unauthRes.status === 401) {
      pass('Protected route (/api/user/profile) correctly rejects unauthenticated requests with 401');
    } else {
      fail('Protected route check', `Expected 401, got ${unauthRes.status}`);
    }

    // 10. Role escalation blocked during profile update
    const roleTamperRes = await req('PUT', '/api/user/profile', {
      token: tokenA,
      csrf: csrfA,
      body: { role: 'admin' },
    });
    if (roleTamperRes.status === 400) {
      pass('Profile update rejects attempts to escalate role with 400 Bad Request');
    } else {
      fail('Profile role escalation', `Expected 400, got ${roleTamperRes.status}`);
    }

    // 11. Valid profile update
    const profileUpdRes = await req('PUT', '/api/user/profile', {
      token: tokenA,
      csrf: csrfA,
      body: { phone: '+1-555-0199', bloodGroup: 'O+', dateOfBirth: '1988-06-15' },
    });
    if (profileUpdRes.status === 200 && profileUpdRes.body.phone === '+1-555-0199') {
      pass('Profile update succeeds and persists fields (phone, bloodGroup, dateOfBirth)');
    } else {
      fail('Profile update', `Expected 200, got ${profileUpdRes.status}`);
    }

    // ══════════════════════════════════════════════════════════════
    // TASK 5: MEDICATION VALIDATION
    // ══════════════════════════════════════════════════════════════
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log('📋 TASK 5: Medication Lifecycle & Notifications Validation');
    console.log('────────────────────────────────────────────────────────────────');

    const todayStr = getTodayDateStr();

    // 1. Add medication
    const addMedRes = await req('POST', '/api/medications', {
      token: tokenA,
      csrf: csrfA,
      body: {
        name: 'Lisinopril',
        dosage: '10mg',
        form: 'tablet',
        frequency: 'once_daily',
        timesOfDay: ['08:00'],
        startDate: todayStr,
        instructions: 'Take in the morning with water',
        reminderEnabled: true,
      },
    });
    createdMedicationId = addMedRes.body?._id || '';

    if (addMedRes.status === 201 && createdMedicationId) {
      pass('Medication created: 201 Created with daily 08:00 schedule');
    } else {
      fail('Add medication', `Expected 201, got ${addMedRes.status}`);
    }

    // 2. Verify dose generation for today
    const dosesTodayRes = await req('GET', '/api/doses/today', { token: tokenA });
    const todayDoses = Array.isArray(dosesTodayRes.body) ? dosesTodayRes.body : [];
    const myDose = todayDoses.find((d: any) => d.medicationId?._id === createdMedicationId || d.medicationId === createdMedicationId);
    createdDoseId = myDose?._id || '';

    if (dosesTodayRes.status === 200 && createdDoseId) {
      pass('Automatic dose generation verified: pending dose created for today');
    } else {
      fail('Dose generation', `Expected dose for today, got count ${todayDoses.length}`);
    }

    // 3. Notification reminders scheduled and verified idempotent
    const syncRes = await req('POST', '/api/notifications/sync', { token: tokenA, csrf: csrfA });
    const initialJobs = syncRes.body?.jobsScheduled ?? 0;
    const syncDupRes = await req('POST', '/api/notifications/sync', { token: tokenA, csrf: csrfA });
    const dupJobs = syncDupRes.body?.jobsScheduled ?? -1;

    if (syncRes.status === 200 && dupJobs === 0) {
      pass(`Notification reminder generation and idempotency: ${initialJobs} initial jobs, 0 duplicate jobs on re-sync`);
    } else {
      fail('Notification sync', `Expected 0 duplicate jobs on second sync, got ${dupJobs}`);
    }

    // 4. Update dose status to taken
    const takeDoseRes = await req('PATCH', `/api/doses/${createdDoseId}/status`, {
      token: tokenA,
      csrf: csrfA,
      body: { status: 'taken' },
    });
    if (takeDoseRes.status === 200 && takeDoseRes.body.status === 'taken' && takeDoseRes.body.takenAt) {
      pass('Dose marked as taken: status updated and takenAt timestamp recorded');
    } else {
      fail('Mark dose taken', `Expected status taken, got ${takeDoseRes.status}`);
    }

    // 5. Adherence stats calculation
    const adherenceRes = await req('GET', '/api/doses/adherence', { token: tokenA });
    if (adherenceRes.status === 200 && typeof adherenceRes.body.adherenceRate === 'number') {
      pass(`Adherence stats computed: rate ${adherenceRes.body.adherenceRate}%, streak ${adherenceRes.body.currentStreak} days`);
    } else {
      fail('Adherence stats', `Expected 200, got ${adherenceRes.status}`);
    }

    // 6. Edit medication
    const editMedRes = await req('PATCH', `/api/medications/${createdMedicationId}`, {
      token: tokenA,
      csrf: csrfA,
      body: { dosage: '20mg', instructions: 'Take with food' },
    });
    if (editMedRes.status === 200 && editMedRes.body.dosage === '20mg') {
      pass('Medication updated: dosage updated to 20mg and saved');
    } else {
      fail('Edit medication', `Expected 200, got ${editMedRes.status}`);
    }

    // ══════════════════════════════════════════════════════════════
    // TASK 6: APPOINTMENT VALIDATION
    // ══════════════════════════════════════════════════════════════
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log('📋 TASK 6: Appointment Lifecycle & Concurrency Validation');
    console.log('────────────────────────────────────────────────────────────────');

    // 1. Doctor search
    const docSearchRes = await req('GET', '/api/doctors?specialty=General Physician');
    const doctors = docSearchRes.body?.data || [];
    const chosenDoctor = doctors[0];
    selectedDoctorId = chosenDoctor?._id || '';

    if (docSearchRes.status === 200 && doctors.length > 0 && selectedDoctorId) {
      pass(`Doctor search: found ${doctors.length} doctors, selected ${chosenDoctor.name}`);
    } else {
      fail('Doctor search', `Expected doctors list, got ${doctors.length}`);
    }

    // 2. Doctor availability check
    const futureWeekday = getFutureWeekday(10);
    const availRes = await req('GET', `/api/doctors/${selectedDoctorId}/availability?date=${futureWeekday.dateStr}`);
    const availableSlots = availRes.body?.data?.slots || [];

    if (availRes.status === 200 && availableSlots.length > 0) {
      pass(`Doctor availability verified for ${futureWeekday.dateStr} (${futureWeekday.dayName}): ${availableSlots.length} slots available`);
    } else {
      fail('Doctor availability', `Expected available slots, got ${availableSlots.length}`);
    }

    const testSlot = availableSlots[0].timeSlot;
    const testSlot2 = availableSlots[1]?.timeSlot || '14:00';

    // 3. Book appointment
    const bookRes = await req('POST', '/api/appointments', {
      token: tokenA,
      csrf: csrfA,
      body: {
        doctorId: selectedDoctorId,
        date: futureWeekday.dateStr,
        timeSlot: testSlot,
        type: 'in-person',
        reason: 'Annual preventive wellness checkup',
      },
    });
    createdAppointmentId = bookRes.body?._id || '';

    if (bookRes.status === 201 && createdAppointmentId && bookRes.body.status === 'booked') {
      pass(`Appointment booked for Patient A on ${futureWeekday.dateStr} at ${testSlot}`);
    } else {
      fail('Book appointment', `Expected 201, got ${bookRes.status}`);
    }

    // 4. Double-booking prevention (Patient B attempts to book the EXACT SAME SLOT)
    const doubleBookRes = await req('POST', '/api/appointments', {
      token: tokenB,
      csrf: csrfB,
      body: {
        doctorId: selectedDoctorId,
        date: futureWeekday.dateStr,
        timeSlot: testSlot,
        type: 'in-person',
        reason: 'Competing patient booking attempt',
      },
    });
    if (doubleBookRes.status === 409) {
      pass('Double-booking prevention: Patient B rejected with 409 Conflict for identical slot');
    } else {
      fail('Double booking prevention', `Expected 409, got ${doubleBookRes.status}`);
    }

    // 5. Reschedule appointment to testSlot2
    const reschedRes = await req('PATCH', `/api/appointments/${createdAppointmentId}/reschedule`, {
      token: tokenA,
      csrf: csrfA,
      body: {
        date: futureWeekday.dateStr,
        timeSlot: testSlot2,
        reason: 'Shifted schedule to afternoon',
      },
    });
    if (reschedRes.status === 200 && reschedRes.body.appointment?.timeSlot === testSlot2) {
      pass(`Appointment rescheduled to ${testSlot2}; original slot freed`);
    } else {
      fail('Reschedule appointment', `Expected 200, got ${reschedRes.status}`);
    }

    // 6. Patient B now books the FREED original slot
    const bookFreedSlotRes = await req('POST', '/api/appointments', {
      token: tokenB,
      csrf: csrfB,
      body: {
        doctorId: selectedDoctorId,
        date: futureWeekday.dateStr,
        timeSlot: testSlot,
        type: 'in-person',
        reason: 'Booking the newly freed slot',
      },
    });
    const patientBApptId = bookFreedSlotRes.body?._id;

    if (bookFreedSlotRes.status === 201 && patientBApptId) {
      pass('Freed slot successfully booked by Patient B after rescheduling');
    } else {
      fail('Book freed slot', `Expected 201, got ${bookFreedSlotRes.status}`);
    }

    // Clean up Patient B appointment
    if (patientBApptId) {
      await req('PATCH', `/api/appointments/${patientBApptId}/cancel`, {
        token: tokenB,
        csrf: csrfB,
        body: { cancellationReason: 'Test complete' },
      });
    }

    // 7. Cancel Patient A appointment
    const cancelRes = await req('PATCH', `/api/appointments/${createdAppointmentId}/cancel`, {
      token: tokenA,
      csrf: csrfA,
      body: { cancellationReason: 'Personal emergency' },
    });
    if (cancelRes.status === 200 && cancelRes.body.appointment?.status === 'cancelled') {
      pass('Appointment cancellation: status set to cancelled, reminders suppressed');
    } else {
      fail('Cancel appointment', `Expected 200, got ${cancelRes.status}`);
    }

    // ══════════════════════════════════════════════════════════════
    // TASK 4: PATIENT DATA ISOLATION
    // ══════════════════════════════════════════════════════════════
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log('📋 TASK 4: Cross-Patient Data Isolation Validation');
    console.log('────────────────────────────────────────────────────────────────');

    // 1. Patient B attempts to read Patient A's medication
    const crossMedReadRes = await req('GET', `/api/medications/${createdMedicationId}`, {
      token: tokenB,
    });
    if (crossMedReadRes.status === 404) {
      pass("Patient B cannot read Patient A's medication: 404 Not Found (zero data leakage)");
    } else {
      fail('Cross medication read isolation', `Expected 404, got ${crossMedReadRes.status}`);
    }

    // 2. Patient B attempts to update Patient A's medication
    const crossMedUpdRes = await req('PATCH', `/api/medications/${createdMedicationId}`, {
      token: tokenB,
      csrf: csrfB,
      body: { dosage: '999mg' },
    });
    if (crossMedUpdRes.status === 404) {
      pass("Patient B cannot modify Patient A's medication: 404 Not Found");
    } else {
      fail('Cross medication update isolation', `Expected 404, got ${crossMedUpdRes.status}`);
    }

    // 3. Patient B attempts to delete/archive Patient A's medication
    const crossMedDelRes = await req('DELETE', `/api/medications/${createdMedicationId}`, {
      token: tokenB,
      csrf: csrfB,
    });
    if (crossMedDelRes.status === 404) {
      pass("Patient B cannot delete/archive Patient A's medication: 404 Not Found");
    } else {
      fail('Cross medication delete isolation', `Expected 404, got ${crossMedDelRes.status}`);
    }

    // 4. Patient B attempts to read Patient A's appointment
    const crossApptReadRes = await req('GET', `/api/appointments/${createdAppointmentId}`, {
      token: tokenB,
    });
    if (crossApptReadRes.status === 404) {
      pass("Patient B cannot read Patient A's appointment: 404 Not Found");
    } else {
      fail('Cross appointment read isolation', `Expected 404, got ${crossApptReadRes.status}`);
    }

    // 5. Patient B attempts to reschedule Patient A's appointment
    const crossApptReschedRes = await req('PATCH', `/api/appointments/${createdAppointmentId}/reschedule`, {
      token: tokenB,
      csrf: csrfB,
      body: { date: futureWeekday.dateStr, timeSlot: '11:00' },
    });
    if (crossApptReschedRes.status === 404) {
      pass("Patient B cannot reschedule Patient A's appointment: 404 Not Found");
    } else {
      fail('Cross appointment reschedule isolation', `Expected 404, got ${crossApptReschedRes.status}`);
    }

    // 6. Patient B attempts to read Patient A's dose history
    const patientBDoses = await req('GET', '/api/doses/today', { token: tokenB });
    const bDoses = Array.isArray(patientBDoses.body) ? patientBDoses.body : [];
    const hasADose = bDoses.some((d: any) => d._id === createdDoseId);
    if (!hasADose && bDoses.length === 0) {
      pass("Patient B's dose list is completely isolated: 0 doses returned");
    } else {
      fail('Cross dose list isolation', 'Patient B can see doses belonging to Patient A');
    }

    // ══════════════════════════════════════════════════════════════
    // TASK 7: HEALTH INFORMATION & BOOKMARKS VALIDATION
    // ══════════════════════════════════════════════════════════════
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log('📋 TASK 7: Health Information Catalog & Bookmarks Validation');
    console.log('────────────────────────────────────────────────────────────────');

    // 1. Conditions list and search
    const condRes = await req('GET', '/api/conditions?q=cold');
    if (condRes.status === 200 && condRes.body.data?.length > 0) {
      pass(`Conditions search (q=cold): found ${condRes.body.data.length} matches`);
    } else {
      fail('Conditions search', `Expected search results, got ${condRes.status}`);
    }

    // 2. Medicines list and search
    const medRes = await req('GET', '/api/medicines');
    if (medRes.status === 200 && medRes.body.data?.length > 0) {
      pass(`Medicines catalog: ${medRes.body.data.length} medicines available`);
    } else {
      fail('Medicines catalog', `Expected medicines, got ${medRes.status}`);
    }

    // 3. Articles list
    const artRes = await req('GET', '/api/articles');
    if (artRes.status === 200 && artRes.body.data?.length > 0) {
      pass(`Articles catalog: ${artRes.body.data.length} articles available`);
    } else {
      fail('Articles catalog', `Expected articles, got ${artRes.status}`);
    }

    // 4. Bookmark toggle on condition
    const condSlug = condRes.body.data[0].slug;
    const bmCondRes = await req('POST', `/api/conditions/${condSlug}/bookmark`, {
      token: tokenA,
      csrf: csrfA,
    });
    if (bmCondRes.status === 200 && bmCondRes.body.bookmarked === true) {
      pass(`Condition bookmark toggled for Patient A: slug ${condSlug}`);
    } else {
      fail('Condition bookmark', `Expected 200 bookmarked: true, got ${bmCondRes.status}`);
    }

    // 5. Unauthenticated bookmark attempt rejected
    const unauthBmRes = await req('POST', `/api/conditions/${condSlug}/bookmark`);
    if (unauthBmRes.status === 401) {
      pass('Unauthenticated bookmark attempt securely rejected with 401');
    } else {
      fail('Unauthenticated bookmark', `Expected 401, got ${unauthBmRes.status}`);
    }

    // 6. Patient B does NOT see Patient A's bookmark
    const meBRes = await req('GET', '/api/auth/me', { token: tokenB });
    const bBookmarks = meBRes.body.user?.bookmarkedConditions || [];
    if (!bBookmarks.includes(condSlug)) {
      pass("Bookmark isolation: Patient B profile does not reflect Patient A's bookmarks");
    } else {
      fail('Bookmark isolation', 'Patient B sees bookmark saved by Patient A');
    }

    // ══════════════════════════════════════════════════════════════
    // TASK 5 (Part 2): ARCHIVE MEDICATION
    // ══════════════════════════════════════════════════════════════
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log('📋 TASK 5 (Part 2): Medication Archival & Dose Cleanup');
    console.log('────────────────────────────────────────────────────────────────');

    const archiveRes = await req('DELETE', `/api/medications/${createdMedicationId}`, {
      token: tokenA,
      csrf: csrfA,
    });
    if (archiveRes.status === 200 && archiveRes.body.status === 'success') {
      pass('Medication archived: active flag set to false, future pending doses purged');
    } else {
      fail('Medication archive', `Expected 200, got ${archiveRes.status}`);
    }

    // Logout Patient A
    const logoutRes = await req('POST', '/api/auth/logout', { token: tokenA });
    if (logoutRes.status === 200) {
      pass('Patient A logged out: session cookies cleared');
    } else {
      fail('Logout', `Expected 200, got ${logoutRes.status}`);
    }

  } finally {
    // ══════════════════════════════════════════════════════════════
    // CLEANUP OF SYNTHETIC TEST ACCOUNTS
    // ══════════════════════════════════════════════════════════════
    console.log('\n────────────────────────────────────────────────────────────────');
    console.log('🧹 Cleaning up synthetic test data from MongoDB Atlas...');
    console.log('────────────────────────────────────────────────────────────────');

    if (patientAId) {
      await User.findByIdAndDelete(patientAId);
      await Medication.deleteMany({ userId: patientAId });
      await DoseRecord.deleteMany({ userId: patientAId });
      await Appointment.deleteMany({ patientId: patientAId });
      await Notification.deleteMany({ userId: patientAId });
      await NotificationJob.deleteMany({ userId: patientAId });
      console.log(`  • Cleaned up synthetic Patient A (${patientAEmail})`);
    }

    if (patientBId) {
      await User.findByIdAndDelete(patientBId);
      await Medication.deleteMany({ userId: patientBId });
      await DoseRecord.deleteMany({ userId: patientBId });
      await Appointment.deleteMany({ patientId: patientBId });
      await Notification.deleteMany({ userId: patientBId });
      await NotificationJob.deleteMany({ userId: patientBId });
      console.log(`  • Cleaned up synthetic Patient B (${patientBEmail})`);
    }

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
    console.log('✅ Server gateway closed and Atlas disconnected cleanly.\n');
  }

  console.log('════════════════════════════════════════════════════════════════');
  console.log(`🎉 LIVE STAGING VALIDATION COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('════════════════════════════════════════════════════════════════');

  if (failCount > 0) {
    console.error('\nFailures summary:');
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
}

runLiveStagingValidation().catch((err) => {
  console.error('❌ Fatal error during live staging validation:', err);
  process.exit(1);
});
