import { Types } from 'mongoose';
import { User, IUser } from '../models/User.js';
import { Medication, IMedication } from '../models/Medication.js';
import { DoseRecord, IDoseRecord } from '../models/DoseRecord.js';
import { Appointment, IAppointment } from '../models/Appointment.js';
import { NotificationJob } from '../models/NotificationJob.js';
import { generateDosesForUser } from '../utils/scheduler.js';
import {
  isValidTimeZone,
  isValidTimeStr,
  isCurrentlyQuietHours,
  isQuietHoursOvernight,
} from '../utils/userValidation.js';

/**
 * Calculates the exact UTC Date when the quiet hours window ends.
 */
export function calculateQuietHoursEnd(
  referenceDate: Date,
  quietHoursStart: string,
  quietHoursEnd: string,
  timeZone = 'UTC'
): Date {
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC';

  // Extract local date parts for the reference date in target timeZone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(referenceDate);
  const localYear = parseInt(parts.find((p) => p.type === 'year')?.value || '1970', 10);
  const localMonth = parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10);
  const localDay = parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10);
  const localHour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);

  const [endHour, endMinute] = quietHoursEnd.split(':').map(Number);
  const [startHour] = quietHoursStart.split(':').map(Number);

  let targetDay = localDay;
  if (isQuietHoursOvernight(quietHoursStart, quietHoursEnd)) {
    // If current local hour is at or after startHour (e.g. 23:00 >= 22:00), end is next calendar day
    if (localHour >= startHour) {
      targetDay += 1;
    }
  }

  // Iteratively determine the UTC epoch that maps to target local time in timeZone
  const targetLocalUtcGuess = Date.UTC(localYear, localMonth - 1, targetDay, endHour, endMinute, 0, 0);
  const guessDate = new Date(targetLocalUtcGuess);

  // Measure timezone offset at that time
  const guessParts = formatter.formatToParts(guessDate);
  const guessHour = parseInt(guessParts.find((p) => p.type === 'hour')?.value || '0', 10);
  const guessMinute = parseInt(guessParts.find((p) => p.type === 'minute')?.value || '0', 10);
  const guessDay = parseInt(guessParts.find((p) => p.type === 'day')?.value || '1', 10);

  const hourDiff = (guessDay - targetDay) * 24 + (guessHour - endHour);
  const minDiff = guessMinute - endMinute;
  const totalOffsetMs = (hourDiff * 60 + minDiff) * 60 * 1000;

  return new Date(targetLocalUtcGuess - totalOffsetMs);
}

/**
 * Checks quiet hours preferences and calculates the effective scheduled UTC timestamp.
 */
export function getEffectiveScheduledTime(
  intendedDate: Date,
  prefs?: IUser['notificationPreferences']
): {
  scheduledFor: Date;
  isDeferred: boolean;
  reason?: string;
  isExpired?: boolean;
} {
  if (!prefs || !prefs.quietHoursEnabled) {
    return { scheduledFor: intendedDate, isDeferred: false };
  }

  const { quietHoursStart, quietHoursEnd, timeZone } = prefs;
  if (!isValidTimeStr(quietHoursStart) || !isValidTimeStr(quietHoursEnd)) {
    return { scheduledFor: intendedDate, isDeferred: false };
  }

  const isQuiet = isCurrentlyQuietHours(intendedDate, quietHoursStart, quietHoursEnd, timeZone);
  if (!isQuiet) {
    return { scheduledFor: intendedDate, isDeferred: false };
  }

  const deferredTime = calculateQuietHoursEnd(intendedDate, quietHoursStart, quietHoursEnd, timeZone);

  return {
    scheduledFor: deferredTime,
    isDeferred: true,
    reason: 'quiet_hours',
  };
}

/**
 * Schedules medication reminders for a specific user over a lookahead window (default 24h).
 * Reuses existing dose-generation and DoseRecord scheduler.
 * Completely idempotent: uses unique compound idempotency keys.
 */
export async function scheduleMedicationRemindersForUser(
  userId: string | Types.ObjectId,
  horizonHours = 24,
  now = new Date()
): Promise<number> {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    return 0;
  }

  // If user disabled medication reminders, skip
  if (user.notificationPreferences && user.notificationPreferences.medicationReminders === false) {
    return 0;
  }

  // Ensure doses are generated for today and tomorrow
  await generateDosesForUser(userId, 2);

  const horizonEnd = new Date(now.getTime() + horizonHours * 60 * 60 * 1000);
  // Also look back 15 minutes for recently created doses that haven't been scheduled
  const lookbackStart = new Date(now.getTime() - 15 * 60 * 1000);

  const doses = await DoseRecord.find({
    userId,
    status: 'pending',
    scheduledAt: { $gte: lookbackStart, $lte: horizonEnd },
  }).populate('medicationId');

  let scheduledJobsCount = 0;

  for (const dose of doses) {
    const med = dose.medicationId as unknown as IMedication;
    // Medication must be active, not archived, and reminderEnabled !== false
    if (!med || !med.isActive || med.reminderEnabled === false) {
      continue;
    }

    const { scheduledFor, isDeferred, reason } = getEffectiveScheduledTime(
      dose.scheduledAt,
      user.notificationPreferences
    );

    // Stale reminder policy: if deferred time is >14 hours after scheduled dose, mark as expired and do not schedule
    const deferralLagMs = scheduledFor.getTime() - dose.scheduledAt.getTime();
    if (deferralLagMs > 14 * 60 * 60 * 1000) {
      continue;
    }

    const channels: ('in_app' | 'email')[] = ['in_app'];
    if (user.notificationPreferences?.emailUpdates) {
      channels.push('email');
    }

    for (const channel of channels) {
      const idempotencyKey = `med_${dose._id}_${channel}`;

      const jobDoc = {
        userId: user._id,
        jobType: 'medication_reminder',
        channel,
        idempotencyKey,
        status: 'pending',
        scheduledFor,
        originalScheduledFor: dose.scheduledAt,
        deferredReason: isDeferred ? reason : undefined,
        attempts: 0,
        maxAttempts: 3,
        payload: {
          title: `Medication Reminder: ${med.name}`,
          message: `Time to take your scheduled dose of ${med.name}${med.dosage ? ` (${med.dosage})` : ''}.`,
          referenceId: dose._id.toString(),
          referenceType: 'dose',
          recipientEmail: user.email,
          recipientName: user.name,
          meta: {
            medicationId: med._id.toString(),
            medicationName: med.name,
            dosage: med.dosage,
            form: med.form,
            scheduledDate: dose.scheduledDate,
            scheduledTime: dose.scheduledTime,
          },
        },
      };

      const result = await NotificationJob.updateOne(
        { idempotencyKey },
        { $setOnInsert: jobDoc },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        scheduledJobsCount++;
      }
    }
  }

  return scheduledJobsCount;
}

/**
 * Schedules appointment reminder jobs for a newly booked or updated appointment.
 * Creates 24-hour and 1-hour reminders if eligible.
 * Deterministic policy:
 * - If appointment is <24 hours away at booking, 24h reminder is skipped.
 * - If appointment is <1 hour away at booking, 1h reminder is skipped.
 */
export async function scheduleAppointmentReminders(
  appointment: IAppointment,
  now = new Date()
): Promise<number> {
  if (['cancelled', 'completed'].includes(appointment.status)) {
    return 0;
  }

  const user = await User.findById(appointment.patientId);
  if (!user || !user.isActive) {
    return 0;
  }

  // Check user preference
  if (user.notificationPreferences && user.notificationPreferences.appointmentAlerts === false) {
    return 0;
  }

  const channels: ('in_app' | 'email')[] = ['in_app'];
  if (user.notificationPreferences?.emailUpdates) {
    channels.push('email');
  }

  let createdCount = 0;
  const startAtTime = appointment.startAt.getTime();

  // 1. 24-Hour Reminder
  const reminder24hTime = new Date(startAtTime - 24 * 60 * 60 * 1000);
  if (reminder24hTime.getTime() > now.getTime()) {
    const { scheduledFor, isDeferred, reason } = getEffectiveScheduledTime(
      reminder24hTime,
      user.notificationPreferences
    );

    // If deferred time extends past appointment start, do not schedule
    if (scheduledFor.getTime() < appointment.startAt.getTime()) {
      for (const channel of channels) {
        const idempotencyKey = `appt_24h_${appointment._id}_${startAtTime}_${channel}`;
        const result = await NotificationJob.updateOne(
          { idempotencyKey },
          {
            $setOnInsert: {
              userId: user._id,
              jobType: 'appointment_24h',
              channel,
              idempotencyKey,
              status: 'pending',
              scheduledFor,
              originalScheduledFor: reminder24hTime,
              deferredReason: isDeferred ? reason : undefined,
              attempts: 0,
              maxAttempts: 3,
              payload: {
                title: `Upcoming Appointment Tomorrow: Dr. ${appointment.doctorName}`,
                message: `You have an appointment with Dr. ${appointment.doctorName} tomorrow at ${appointment.timeSlot} (${appointment.timezone || 'UTC'}).`,
                referenceId: appointment._id.toString(),
                referenceType: 'appointment',
                recipientEmail: user.email,
                recipientName: user.name,
                meta: {
                  appointmentId: appointment._id.toString(),
                  doctorName: appointment.doctorName,
                  doctorSpecialty: appointment.doctorSpecialty,
                  date: appointment.date,
                  timeSlot: appointment.timeSlot,
                  type: appointment.type,
                },
              },
            },
          },
          { upsert: true }
        );
        if (result.upsertedCount > 0) createdCount++;
      }
    }
  }

  // 2. 1-Hour Reminder
  const reminder1hTime = new Date(startAtTime - 1 * 60 * 60 * 1000);
  if (reminder1hTime.getTime() > now.getTime()) {
    const { scheduledFor, isDeferred, reason } = getEffectiveScheduledTime(
      reminder1hTime,
      user.notificationPreferences
    );

    if (scheduledFor.getTime() < appointment.startAt.getTime()) {
      for (const channel of channels) {
        const idempotencyKey = `appt_1h_${appointment._id}_${startAtTime}_${channel}`;
        const result = await NotificationJob.updateOne(
          { idempotencyKey },
          {
            $setOnInsert: {
              userId: user._id,
              jobType: 'appointment_1h',
              channel,
              idempotencyKey,
              status: 'pending',
              scheduledFor,
              originalScheduledFor: reminder1hTime,
              deferredReason: isDeferred ? reason : undefined,
              attempts: 0,
              maxAttempts: 3,
              payload: {
                title: `Upcoming Appointment in 1 Hour: Dr. ${appointment.doctorName}`,
                message: `Your appointment with Dr. ${appointment.doctorName} begins in 1 hour at ${appointment.timeSlot}.`,
                referenceId: appointment._id.toString(),
                referenceType: 'appointment',
                recipientEmail: user.email,
                recipientName: user.name,
                meta: {
                  appointmentId: appointment._id.toString(),
                  doctorName: appointment.doctorName,
                  doctorSpecialty: appointment.doctorSpecialty,
                  date: appointment.date,
                  timeSlot: appointment.timeSlot,
                  type: appointment.type,
                },
              },
            },
          },
          { upsert: true }
        );
        if (result.upsertedCount > 0) createdCount++;
      }
    }
  }

  return createdCount;
}

/**
 * Reschedules appointment reminders by invalidating obsolete pending jobs
 * and creating fresh jobs for the new appointment time.
 */
export async function rescheduleAppointmentReminders(
  appointment: IAppointment,
  now = new Date()
): Promise<number> {
  // Invalidate any previously scheduled pending jobs for this appointment
  await NotificationJob.updateMany(
    {
      'payload.referenceId': appointment._id.toString(),
      status: 'pending',
    },
    {
      $set: { status: 'cancelled' },
    }
  );

  return scheduleAppointmentReminders(appointment, now);
}

/**
 * Cancels all pending notification jobs for an appointment upon cancellation.
 */
export async function cancelAppointmentReminders(
  appointmentId: string | Types.ObjectId
): Promise<number> {
  const result = await NotificationJob.updateMany(
    {
      'payload.referenceId': appointmentId.toString(),
      status: 'pending',
    },
    {
      $set: { status: 'cancelled' },
    }
  );

  return result.modifiedCount;
}

/**
 * Cancels any pending notification jobs for a dose record (e.g. when taken or skipped).
 */
export async function cancelMedicationReminderForDose(
  doseId: string | Types.ObjectId
): Promise<number> {
  const result = await NotificationJob.updateMany(
    {
      'payload.referenceId': doseId.toString(),
      status: 'pending',
    },
    {
      $set: { status: 'cancelled' },
    }
  );

  return result.modifiedCount;
}

/**
 * Reschedules reminder for a snoozed dose.
 */
export async function snoozeMedicationReminder(
  dose: IDoseRecord,
  snoozedUntil: Date,
  userPrefs?: IUser['notificationPreferences']
): Promise<number> {
  // Cancel old pending reminders for this dose
  await cancelMedicationReminderForDose(dose._id);

  const user = await User.findById(dose.userId);
  if (!user || !user.isActive) return 0;
  if (user.notificationPreferences?.medicationReminders === false) return 0;

  const med = await Medication.findById(dose.medicationId);
  if (!med || !med.isActive) return 0;

  const { scheduledFor, isDeferred, reason } = getEffectiveScheduledTime(
    snoozedUntil,
    userPrefs || user.notificationPreferences
  );

  const channels: ('in_app' | 'email')[] = ['in_app'];
  if (user.notificationPreferences?.emailUpdates) {
    channels.push('email');
  }

  let count = 0;
  for (const channel of channels) {
    const idempotencyKey = `med_${dose._id}_snooze_${snoozedUntil.getTime()}_${channel}`;
    const result = await NotificationJob.updateOne(
      { idempotencyKey },
      {
        $setOnInsert: {
          userId: user._id,
          jobType: 'medication_reminder',
          channel,
          idempotencyKey,
          status: 'pending',
          scheduledFor,
          originalScheduledFor: snoozedUntil,
          deferredReason: isDeferred ? reason : undefined,
          attempts: 0,
          maxAttempts: 3,
          payload: {
            title: `Snoozed Medication Reminder: ${med.name}`,
            message: `Time to take your snoozed dose of ${med.name}${med.dosage ? ` (${med.dosage})` : ''}.`,
            referenceId: dose._id.toString(),
            referenceType: 'dose',
            recipientEmail: user.email,
            recipientName: user.name,
            meta: {
              medicationId: med._id.toString(),
              medicationName: med.name,
              dosage: med.dosage,
              snoozedUntil: snoozedUntil.toISOString(),
            },
          },
        },
      },
      { upsert: true }
    );
    if (result.upsertedCount > 0) count++;
  }

  return count;
}
