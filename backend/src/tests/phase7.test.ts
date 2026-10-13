/**
 * Automated Test Suite for Phase 7: Notification Delivery & Background Jobs
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
import { Notification } from '../models/Notification.js';
import { NotificationJob } from '../models/NotificationJob.js';

import authRoutes from '../routes/authRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import medicationRoutes from '../routes/medicationRoutes.js';
import doseRoutes from '../routes/doseRoutes.js';
import appointmentRoutes from '../routes/appointmentRoutes.js';
import doctorRoutes from '../routes/doctorRoutes.js';
import healthRoutes from '../routes/healthRoutes.js';
import notificationRoutes from '../routes/notificationRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

import {
  scheduleMedicationRemindersForUser,
  scheduleAppointmentReminders,
  rescheduleAppointmentReminders,
  cancelAppointmentReminders,
  cancelMedicationReminderForDose,
  snoozeMedicationReminder,
  getEffectiveScheduledTime,
  calculateQuietHoursEnd,
} from '../services/notificationScheduler.js';
import { NotificationWorker } from '../services/notificationWorker.js';

const TEST_PORT = 5094;
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
app.use('/api/notifications', notificationRoutes);
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
  const cookieHeader = Array.isArray(rawCookies)
    ? rawCookies.map((c) => c.split(';')[0]).join('; ')
    : String(rawCookies).split(';')[0];

  return {
    user: data.user,
    token: data.csrfToken,
    cookies: cookieHeader,
  };
}

async function runTests() {
  console.log('\n🧪 Starting Phase 7 Notification Delivery & Background Jobs Test Suite...\n');

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

  try {
    // ─── Test 1: Medication reminder job scheduling for eligible doses ────────
    console.log('Test 1: Medication reminder scheduling for eligible doses');
    const alice = await createTestUserSession('Alice Smith', 'alice.test1');

    // Create an active daily medication for Alice
    const medRes = await fetch(`${BASE_URL}/medications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': alice.token,
        Cookie: alice.cookies,
      },
      body: JSON.stringify({
        name: 'Metformin',
        dosage: '500mg',
        form: 'tablet',
        frequency: 'once_daily',
        timesOfDay: ['09:00'],
        startDate: new Date().toISOString().split('T')[0],
        reminderEnabled: true,
      }),
    });
    assert.equal(medRes.status, 201);
    const medData = (await medRes.json()) as any;

    // Trigger dose generation & reminder scheduling
    const scheduledCount = await scheduleMedicationRemindersForUser(alice.user.id, 24);
    assert.ok(scheduledCount >= 1, 'Should schedule at least 1 reminder job');

    // Verify job in database
    const jobs = await NotificationJob.find({ userId: alice.user.id });
    assert.ok(jobs.length >= 1, 'Jobs should be persisted in NotificationJob collection');
    const job = jobs[0];
    assert.equal(job.status, 'pending');
    assert.equal(job.jobType, 'medication_reminder');
    assert.ok(job.idempotencyKey.includes(alice.user.id) || job.idempotencyKey.startsWith('med_'));
    assert.ok(job.payload.title.includes('Metformin'));
    console.log('  ✓ Verified medication reminder job scheduled with correct payload');

    // ─── Test 2: Ineligible medications & doses receive no reminder jobs ───────
    console.log('Test 2: Ineligible medications (inactive/archived) receive no reminder jobs');
    // Archive medication
    await Medication.findByIdAndUpdate(medData._id, { isActive: false });
    // Remove existing jobs to test fresh run
    await NotificationJob.deleteMany({ userId: alice.user.id });

    const countAfterArchive = await scheduleMedicationRemindersForUser(alice.user.id, 24);
    assert.equal(countAfterArchive, 0, 'No jobs should be scheduled for inactive medication');
    const jobsAfterArchive = await NotificationJob.find({ userId: alice.user.id });
    assert.equal(jobsAfterArchive.length, 0);
    console.log('  ✓ Inactive medication correctly produced 0 reminder jobs');

    // ─── Test 3: Dose status change cancels pending reminder jobs ─────────────
    console.log('Test 3: Marking dose as taken or skipped cancels pending reminder job');
    // Reactivate med
    await Medication.findByIdAndUpdate(medData._id, { isActive: true });
    await scheduleMedicationRemindersForUser(alice.user.id, 24);

    const pendingJobs = await NotificationJob.find({ userId: alice.user.id, status: 'pending' });
    assert.ok(pendingJobs.length >= 1);
    const targetDoseId = pendingJobs[0].payload.referenceId;

    // Alice marks dose as taken via API
    const takenRes = await fetch(`${BASE_URL}/doses/${targetDoseId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': alice.token,
        Cookie: alice.cookies,
      },
      body: JSON.stringify({ status: 'taken' }),
    });
    assert.equal(takenRes.status, 200);

    // Cancel function was called; check job status in DB
    const cancelledJob = await NotificationJob.findOne({
      userId: alice.user.id,
      'payload.referenceId': targetDoseId,
    });
    assert.equal(cancelledJob?.status, 'cancelled');
    console.log('  ✓ Marking dose as taken cancelled associated pending notification job');

    // ─── Test 4: Snoozed dose updates reminder job to snooze timestamp ────────
    console.log('Test 4: Snoozing dose updates reminder job to future snooze timestamp');
    // Create another pending dose
    const dose = await DoseRecord.create({
      userId: alice.user.id,
      medicationId: medData._id,
      scheduledAt: new Date(),
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '12:00',
      status: 'pending',
    });

    const snoozeTime = new Date(Date.now() + 45 * 60 * 1000); // 45 mins in future
    const snoozeRes = await fetch(`${BASE_URL}/doses/${dose._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': alice.token,
        Cookie: alice.cookies,
      },
      body: JSON.stringify({
        status: 'snoozed',
        snoozedUntil: snoozeTime.toISOString(),
      }),
    });
    assert.equal(snoozeRes.status, 200);

    const snoozedJobs = await NotificationJob.find({
      userId: alice.user.id,
      'payload.referenceId': dose._id.toString(),
      status: 'pending',
    });
    assert.ok(snoozedJobs.length >= 1, 'Should create snoozed reminder job');
    assert.equal(
      new Date(snoozedJobs[0].scheduledFor).getTime(),
      snoozeTime.getTime()
    );
    console.log('  ✓ Snoozed dose created new reminder job targeting exact snooze timestamp');

    // ─── Test 5: Appointment reminder scheduling (24h and 1h offsets) ─────────
    console.log('Test 5: Appointment reminder scheduling (24h and 1h offsets)');
    const doctor = await Doctor.create({
      name: 'Dr. Sarah Connor',
      slug: `dr-sarah-${Date.now()}`,
      specialty: 'Cardiologist',
      qualifications: 'MD, FACC',
      consultationFee: 150,
      rating: 4.9,
      reviewCount: 30,
      avatarInitials: 'SC',
      avatarColor: '#2563EB',
      languages: ['English'],
      hospital: 'CareConnect General Hospital',
      isActive: true,
    });

    // Appointment 48 hours in future
    const apptStart48h = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const appt48h = await Appointment.create({
      patientId: alice.user.id,
      doctorId: doctor._id,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialty,
      startAt: apptStart48h,
      endAt: new Date(apptStart48h.getTime() + 30 * 60 * 1000),
      date: apptStart48h.toISOString().split('T')[0],
      timeSlot: '14:00',
      type: 'in-person',
      status: 'booked',
    });

    const apptJobsCreated = await scheduleAppointmentReminders(appt48h);
    assert.ok(apptJobsCreated >= 2, 'Should schedule both 24h and 1h reminders');

    const apptJobs = await NotificationJob.find({
      userId: alice.user.id,
      'payload.referenceId': appt48h._id.toString(),
    });
    const job24h = apptJobs.find((j) => j.jobType === 'appointment_24h');
    const job1h = apptJobs.find((j) => j.jobType === 'appointment_1h');
    assert.ok(job24h, '24-hour reminder job should exist');
    assert.ok(job1h, '1-hour reminder job should exist');
    assert.equal(
      new Date(job24h!.scheduledFor).getTime(),
      apptStart48h.getTime() - 24 * 60 * 60 * 1000
    );
    assert.equal(
      new Date(job1h!.scheduledFor).getTime(),
      apptStart48h.getTime() - 1 * 60 * 60 * 1000
    );
    console.log('  ✓ 24h and 1h appointment reminder offsets computed accurately');

    // Test deterministic policy for appointment booked 3 hours away (24h offset in past)
    const apptStart3h = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const appt3h = await Appointment.create({
      patientId: alice.user.id,
      doctorId: doctor._id,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialty,
      startAt: apptStart3h,
      endAt: new Date(apptStart3h.getTime() + 30 * 60 * 1000),
      date: apptStart3h.toISOString().split('T')[0],
      timeSlot: '11:00',
      type: 'in-person',
      status: 'booked',
    });

    await scheduleAppointmentReminders(appt3h);
    const appt3hJobs = await NotificationJob.find({
      userId: alice.user.id,
      'payload.referenceId': appt3h._id.toString(),
    });
    assert.equal(
      appt3hJobs.some((j) => j.jobType === 'appointment_24h'),
      false,
      '24h reminder should be skipped for appointment booked <24h away'
    );
    assert.equal(
      appt3hJobs.some((j) => j.jobType === 'appointment_1h'),
      true,
      '1h reminder should still be scheduled'
    );
    console.log('  ✓ Deterministic policy skips past 24h reminder for appointments booked <24h away');

    // ─── Test 6: Rescheduled appointment invalidates old reminders ────────────
    console.log('Test 6: Rescheduled appointment invalidates obsolete reminders');
    // Reschedule appt48h to 72h
    const newStart = new Date(Date.now() + 72 * 60 * 60 * 1000);
    appt48h.startAt = newStart;
    appt48h.endAt = new Date(newStart.getTime() + 30 * 60 * 1000);
    await appt48h.save();

    await rescheduleAppointmentReminders(appt48h);

    const updatedApptJobs = await NotificationJob.find({
      userId: alice.user.id,
      'payload.referenceId': appt48h._id.toString(),
    });
    const pendingAfterReschedule = updatedApptJobs.filter((j) => j.status === 'pending');
    assert.ok(pendingAfterReschedule.length >= 2, 'Fresh reminder jobs created');
    const job24hNew = pendingAfterReschedule.find((j) => j.jobType === 'appointment_24h');
    assert.equal(
      new Date(job24hNew!.scheduledFor).getTime(),
      newStart.getTime() - 24 * 60 * 60 * 1000
    );
    console.log('  ✓ Rescheduled appointment updated reminder timestamps');

    // ─── Test 7: Cancelled appointment cancels pending reminder jobs ──────────
    console.log('Test 7: Cancelled appointment cancels pending reminder jobs');
    appt48h.status = 'cancelled';
    await appt48h.save();
    await cancelAppointmentReminders(appt48h._id);

    const jobsAfterCancel = await NotificationJob.find({
      userId: alice.user.id,
      'payload.referenceId': appt48h._id.toString(),
      status: 'pending',
    });
    assert.equal(jobsAfterCancel.length, 0, 'No pending reminder jobs should remain');
    console.log('  ✓ Cancellation invalidated all pending reminder jobs');

    // ─── Test 8: Scheduler idempotency (duplicate runs generate 0 duplicates) ─
    console.log('Test 8: Scheduler idempotency prevents duplicate jobs');
    const initialJobCount = await NotificationJob.countDocuments();
    // Run schedulers again
    await scheduleMedicationRemindersForUser(alice.user.id, 24);
    await scheduleAppointmentReminders(appt3h);
    const finalJobCount = await NotificationJob.countDocuments();
    assert.equal(
      finalJobCount,
      initialJobCount,
      'Running schedulers repeatedly must produce zero duplicates'
    );
    console.log('  ✓ Idempotency verified: 0 duplicate jobs generated on repeat execution');

    // ─── Test 9: User notification preferences respected ───────────────────────
    console.log('Test 9: User disabled reminder preference blocks job generation');
    const bob = await createTestUserSession('Bob Jones', 'bob.test9');

    // Bob disables medication reminders
    await User.findByIdAndUpdate(bob.user.id, {
      'notificationPreferences.medicationReminders': false,
    });

    // Create med for Bob
    await Medication.create({
      userId: bob.user.id,
      name: 'Atorvastatin',
      dosage: '20mg',
      form: 'tablet',
      frequency: 'once_daily',
      timesOfDay: ['08:00'],
      startDate: new Date().toISOString().split('T')[0],
      reminderEnabled: true,
      isActive: true,
    });

    const bobMedsScheduled = await scheduleMedicationRemindersForUser(bob.user.id, 24);
    assert.equal(bobMedsScheduled, 0, 'Should not schedule jobs when preference disabled');
    const bobJobs = await NotificationJob.find({ userId: bob.user.id });
    assert.equal(bobJobs.length, 0);
    console.log('  ✓ Disabled preference safely blocked reminder job creation');

    // ─── Test 10: Quiet hours deferral and midnight crossing ──────────────────
    console.log('Test 10: Quiet hours deferral and cross-midnight handling');
    const quietPrefs = {
      medicationReminders: true,
      appointmentAlerts: true,
      healthTips: false,
      emailUpdates: true,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      timeZone: 'UTC',
    };

    // Date at 23:00 UTC (inside quiet hours)
    const dateAt23h = new Date(Date.UTC(2026, 9, 14, 23, 0, 0));
    const result23h = getEffectiveScheduledTime(dateAt23h, quietPrefs as any);
    assert.equal(result23h.isDeferred, true);
    assert.equal(result23h.reason, 'quiet_hours');
    // Quiet hours end should be 07:00 UTC next day (2026-10-15)
    assert.equal(result23h.scheduledFor.getUTCHours(), 7);
    assert.equal(result23h.scheduledFor.getUTCMinutes(), 0);
    assert.equal(result23h.scheduledFor.getUTCDate(), 15);

    // Date at 02:00 UTC (inside cross-midnight window)
    const dateAt02h = new Date(Date.UTC(2026, 9, 15, 2, 0, 0));
    const result02h = getEffectiveScheduledTime(dateAt02h, quietPrefs as any);
    assert.equal(result02h.isDeferred, true);
    assert.equal(result02h.scheduledFor.getUTCHours(), 7);
    assert.equal(result02h.scheduledFor.getUTCDate(), 15);

    // Date at 14:00 UTC (outside quiet hours)
    const dateAt14h = new Date(Date.UTC(2026, 9, 15, 14, 0, 0));
    const result14h = getEffectiveScheduledTime(dateAt14h, quietPrefs as any);
    assert.equal(result14h.isDeferred, false);
    assert.equal(result14h.scheduledFor.getTime(), dateAt14h.getTime());
    console.log('  ✓ Quiet hours correctly defer overnight jobs to quiet hours end');

    // ─── Test 11: Worker atomic claiming and concurrent lease protection ───────
    console.log('Test 11: Worker atomic claiming and concurrent lease protection');
    const worker1 = new NotificationWorker({ workerId: 'worker-node-1' });
    const worker2 = new NotificationWorker({ workerId: 'worker-node-2' });

    // Create a pending job ready now
    const atomicJob = await NotificationJob.create({
      userId: alice.user.id,
      jobType: 'medication_reminder',
      channel: 'in_app',
      idempotencyKey: `atomic_test_${Date.now()}`,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 1000), // Due in the past
      payload: {
        title: 'Atomic Claim Test',
        message: 'Testing atomic concurrency claiming',
      },
    });

    // Simulate concurrent claim
    const [claimedBy1, claimedBy2] = await Promise.all([
      worker1.claimNextJob(),
      worker2.claimNextJob(),
    ]);

    const winner = claimedBy1 || claimedBy2;
    assert.ok(winner, 'One worker must claim the job');
    // Only one should claim atomicJob; the other gets either null or another job
    assert.ok(
      (claimedBy1?.id === atomicJob.id && claimedBy2?.id !== atomicJob.id) ||
      (claimedBy2?.id === atomicJob.id && claimedBy1?.id !== atomicJob.id),
      'Concurrent workers must never claim the exact same job concurrently'
    );
    console.log('  ✓ Concurrency protection confirmed: atomic claiming prevents double-processing');

    // ─── Test 12: Worker abandoned lease recovery ─────────────────────────────
    console.log('Test 12: Worker abandoned lease recovery (crashed worker)');
    // Set a job to processing with expired lease
    const abandonedJob = await NotificationJob.create({
      userId: alice.user.id,
      jobType: 'medication_reminder',
      channel: 'in_app',
      idempotencyKey: `abandoned_test_${Date.now()}`,
      status: 'processing',
      scheduledFor: new Date(Date.now() - 10000),
      lockedUntil: new Date(Date.now() - 5000), // Expired 5 seconds ago
      lockedBy: 'crashed-worker-999',
      attempts: 1,
      payload: {
        title: 'Recover Abandoned Lease',
        message: 'Simulated worker crash recovery',
      },
    });

    const recoveryWorker = new NotificationWorker({ workerId: 'recovery-worker' });
    const recovered = await recoveryWorker.claimNextJob();
    assert.ok(recovered);
    assert.equal(recovered._id.toString(), abandonedJob._id.toString());
    assert.equal(recovered.lockedBy, 'recovery-worker');
    assert.equal(recovered.attempts, 2);
    console.log('  ✓ Expired lease successfully claimed by recovery worker');

    // ─── Test 13: Bounded retries and permanent failure recording ──────────────
    console.log('Test 13: Bounded retries and permanent failure recording');
    const failingWorker = new NotificationWorker({ workerId: 'failing-worker' });
    failingWorker.simulatedEmailProvider.setSimulateFailure(true, 'SMTP connection refused');

    const retryJob = await NotificationJob.create({
      userId: alice.user.id,
      jobType: 'medication_reminder',
      channel: 'email',
      idempotencyKey: `retry_test_${Date.now()}`,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 1000),
      attempts: 2, // Last attempt before failure (maxAttempts = 3)
      maxAttempts: 3,
      payload: {
        title: 'Retry Test',
        message: 'Will fail permanently on 3rd attempt',
      },
    });

    const claimedRetry = await failingWorker.claimNextJob();
    assert.equal(claimedRetry?._id.toString(), retryJob._id.toString());
    await failingWorker.processJob(claimedRetry!);

    const permanentlyFailed = await NotificationJob.findById(retryJob._id);
    assert.equal(permanentlyFailed?.status, 'failed');
    assert.equal(permanentlyFailed?.attempts, 3);
    assert.ok(permanentlyFailed?.error?.includes('SMTP connection refused'));
    console.log('  ✓ Transient error reached max attempts and permanently recorded status as failed');

    // ─── Test 14: In-app delivery and inbox retrieval ─────────────────────────
    console.log('Test 14: In-app delivery and inbox retrieval');
    const inAppWorker = new NotificationWorker({ workerId: 'inapp-worker' });
    const jobForAlice = await NotificationJob.create({
      userId: alice.user.id,
      jobType: 'medication_reminder',
      channel: 'in_app',
      idempotencyKey: `inapp_delivery_${Date.now()}`,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 1000),
      payload: {
        title: 'Medication Due: Aspirin',
        message: 'Time to take your scheduled dose of Aspirin (81mg)',
      },
    });

    const claimedInApp = await inAppWorker.claimNextJob();
    assert.equal(claimedInApp?._id.toString(), jobForAlice._id.toString());
    await inAppWorker.processJob(claimedInApp!);

    // Check NotificationJob is delivered
    const deliveredJob = await NotificationJob.findById(jobForAlice._id);
    assert.equal(deliveredJob?.status, 'delivered');
    assert.ok(deliveredJob?.deliveredAt);

    // Retrieve via API for Alice
    const inboxRes = await fetch(`${BASE_URL}/notifications`, {
      headers: { Cookie: alice.cookies },
    });
    assert.equal(inboxRes.status, 200);
    const inboxData = (await inboxRes.json()) as any;
    assert.ok(inboxData.data.length >= 1);
    const notification = inboxData.data.find(
      (n: any) => n.title === 'Medication Due: Aspirin'
    );
    assert.ok(notification, 'Alice inbox should contain the delivered notification');
    assert.equal(notification.read, false);

    const countRes = await fetch(`${BASE_URL}/notifications/unread-count`, {
      headers: { Cookie: alice.cookies },
    });
    assert.equal(countRes.status, 200);
    const countData = (await countRes.json()) as any;
    assert.ok(countData.unreadCount >= 1);
    console.log('  ✓ In-app notification delivered to MongoDB and retrieved via API');

    // ─── Test 15: Mark as read and mark all as read ────────────────────────────
    console.log('Test 15: Mark as read and mark all as read');
    // Mark single notification as read
    const markRes = await fetch(`${BASE_URL}/notifications/${notification._id}/read`, {
      method: 'PATCH',
      headers: {
        'X-CSRF-Token': alice.token,
        Cookie: alice.cookies,
      },
    });
    assert.equal(markRes.status, 200);
    const markData = (await markRes.json()) as any;
    assert.equal(markData.notification.read, true);

    // Mark all as read
    const markAllRes = await fetch(`${BASE_URL}/notifications/mark-all-read`, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': alice.token,
        Cookie: alice.cookies,
      },
    });
    assert.equal(markAllRes.status, 200);

    const countAfterMarkAll = await fetch(`${BASE_URL}/notifications/unread-count`, {
      headers: { Cookie: alice.cookies },
    });
    const countAfterData = (await countAfterMarkAll.json()) as any;
    assert.equal(countAfterData.unreadCount, 0);
    console.log('  ✓ Mark as read and mark all as read succeeded');

    // ─── Test 16: Cross-user isolation and security ────────────────────────────
    console.log('Test 16: Cross-user isolation and security');
    // Bob attempts to read/modify Alice's notification
    const bobAttempt = await fetch(`${BASE_URL}/notifications/${notification._id}/read`, {
      method: 'PATCH',
      headers: {
        'X-CSRF-Token': bob.token,
        Cookie: bob.cookies,
      },
    });
    assert.equal(bobAttempt.status, 404, 'Bob cannot mark Alice notification as read');

    // Unauthenticated request
    const unauth = await fetch(`${BASE_URL}/notifications`);
    assert.equal(unauth.status, 401, 'Unauthenticated request must be rejected');
    console.log('  ✓ Cross-user isolation and unauthenticated protection verified');

    // ─── Test 17: CSRF protection on mutation routes ───────────────────────────
    console.log('Test 17: CSRF protection on notification mutations');
    const noCsrf = await fetch(`${BASE_URL}/notifications/mark-all-read`, {
      method: 'POST',
      headers: {
        Cookie: alice.cookies,
        // No X-CSRF-Token header
      },
    });
    assert.equal(noCsrf.status, 403, 'CSRF token omission must return 403');
    console.log('  ✓ CSRF protection verified on notification mutation routes');

    // ─── Test 18: Simulated email delivery reporting ───────────────────────────
    console.log('Test 18: Simulated email delivery is clearly identified');
    const emailWorker = new NotificationWorker({ workerId: 'email-worker' });
    emailWorker.simulatedEmailProvider.setSimulateFailure(false);

    const emailJob = await NotificationJob.create({
      userId: alice.user.id,
      jobType: 'medication_reminder',
      channel: 'email',
      idempotencyKey: `sim_email_${Date.now()}`,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 1000),
      payload: {
        title: 'Simulated Email Test',
        message: 'This is a simulated delivery',
        recipientEmail: 'alice@careconnect.test',
      },
    });

    const claimedEmail = await emailWorker.claimNextJob();
    assert.equal(claimedEmail?._id.toString(), emailJob._id.toString());
    await emailWorker.processJob(claimedEmail!);

    const deliveredEmailJob = await NotificationJob.findById(emailJob._id);
    assert.equal(deliveredEmailJob?.status, 'delivered');
    assert.equal(deliveredEmailJob?.deliveryResult?.simulated, true);
    assert.equal(deliveredEmailJob?.deliveryResult?.provider, 'simulated_email');
    console.log('  ✓ Simulated email delivery clearly marked as simulated in job record');

    // ─── Test 19: Delivery never alters dose status ────────────────────────────
    console.log('Test 19: Notification delivery never alters medication dose status');
    const doseBefore = await DoseRecord.create({
      userId: alice.user.id,
      medicationId: medData._id,
      scheduledAt: new Date(Date.now() + 10000),
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: '18:00',
      status: 'pending',
    });

    // Send a notification referencing this dose
    const doseJob = await NotificationJob.create({
      userId: alice.user.id,
      jobType: 'medication_reminder',
      channel: 'in_app',
      idempotencyKey: `dose_safety_${Date.now()}`,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 1000),
      payload: {
        title: 'Medication Due Now',
        message: 'Dose notification delivery check',
        referenceId: doseBefore._id.toString(),
        referenceType: 'dose',
      },
    });

    const claimedSafety = await inAppWorker.claimNextJob();
    assert.equal(claimedSafety?._id.toString(), doseJob._id.toString());
    await inAppWorker.processJob(claimedSafety!);

    const doseAfter = await DoseRecord.findById(doseBefore._id);
    assert.equal(
      doseAfter?.status,
      'pending',
      'Dose status must remain "pending" after notification delivery'
    );
    assert.equal(doseAfter?.takenAt, undefined);
    console.log('  ✓ Dose status strictly preserved as "pending" upon notification delivery');

    // ─── Test 20: Regression — Phases 1-6 endpoints remain functional ─────────
    console.log('Test 20: Regression — Phases 1-6 endpoints remain functional');
    const healthRes = await fetch(`${BASE_URL}/health`);
    assert.equal(healthRes.status, 200);

    const profileRes = await fetch(`${BASE_URL}/user/profile`, {
      headers: { Cookie: alice.cookies },
    });
    assert.equal(profileRes.status, 200);

    const dosesToday = await fetch(`${BASE_URL}/doses/today`, {
      headers: { Cookie: alice.cookies },
    });
    assert.equal(dosesToday.status, 200);

    const apptList = await fetch(`${BASE_URL}/appointments`, {
      headers: { Cookie: alice.cookies },
    });
    assert.equal(apptList.status, 200);

    console.log('  ✓ All Phase 1-6 endpoints remain fully operational');

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🎉 ALL 20 PHASE 7 NOTIFICATION & WORKER TESTS PASSED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════════════\n');
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
  console.error('\n❌ Phase 7 test suite failed:', err);
  process.exit(1);
});
