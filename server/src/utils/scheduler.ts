import { Types } from 'mongoose';
import { IMedication, Medication } from '../models/Medication.js';
import { DoseRecord } from '../models/DoseRecord.js';

/**
 * Format a Date object to YYYY-MM-DD in UTC or specified offset
 */
export function formatDateStr(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Return an array of date strings from startDateStr for `count` days
 */
export function getUpcomingDateStrings(startDateStr: string, count = 7): string[] {
  const dates: string[] = [];
  const [year, month, day] = startDateStr.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));

  for (let i = 0; i < count; i++) {
    const current = new Date(base.getTime() + i * 24 * 60 * 60 * 1000);
    dates.push(formatDateStr(current));
  }
  return dates;
}

/**
 * Check if a medication is scheduled on a specific date (YYYY-MM-DD)
 */
export function isMedicationScheduledOnDate(medication: IMedication, dateStr: string): boolean {
  if (dateStr < medication.startDate) {
    return false;
  }

  if (medication.endDate && dateStr > medication.endDate) {
    return false;
  }

  if (medication.frequency === 'as_needed') {
    return false;
  }

  if (medication.frequency === 'weekly') {
    // Scheduled on the day of week corresponding to startDate
    const [startYear, startMonth, startDay] = medication.startDate.split('-').map(Number);
    const startObj = new Date(Date.UTC(startYear, startMonth - 1, startDay));
    const startDayOfWeek = startObj.getUTCDay();

    const [curYear, curMonth, curDay] = dateStr.split('-').map(Number);
    const curObj = new Date(Date.UTC(curYear, curMonth - 1, curDay));
    return curObj.getUTCDay() === startDayOfWeek;
  }

  // Daily recurrence rules (once_daily, twice_daily, etc.) occur every active day
  return true;
}

/**
 * Generate doses for a single medication over a bounded horizon (default 7 days).
 * Completely idempotent: uses $setOnInsert so existing doses and historical statuses are untouched.
 */
export async function generateDosesForMedication(
  medication: IMedication,
  horizonDays = 7,
  referenceDateStr?: string
): Promise<number> {
  if (!medication.isActive) {
    return 0;
  }

  const todayStr = referenceDateStr || formatDateStr(new Date());
  const dateStrings = getUpcomingDateStrings(todayStr, horizonDays);
  let createdCount = 0;

  for (const dateStr of dateStrings) {
    if (!isMedicationScheduledOnDate(medication, dateStr)) {
      continue;
    }

    const times = medication.timesOfDay && medication.timesOfDay.length > 0
      ? medication.timesOfDay
      : ['08:00'];

    for (const timeStr of times) {
      // Compute scheduledAt timestamp in UTC
      const scheduledAt = new Date(`${dateStr}T${timeStr}:00.000Z`);

      const result = await DoseRecord.updateOne(
        {
          userId: medication.userId,
          medicationId: medication._id,
          scheduledDate: dateStr,
          scheduledTime: timeStr,
        },
        {
          $setOnInsert: {
            userId: medication.userId,
            medicationId: medication._id,
            scheduledAt,
            scheduledDate: dateStr,
            scheduledTime: timeStr,
            timezone: medication.timezone || 'UTC',
            status: 'pending',
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        createdCount++;
      }
    }
  }

  return createdCount;
}

/**
 * Generate doses for all active medications belonging to a user.
 */
export async function generateDosesForUser(
  userId: string | Types.ObjectId,
  horizonDays = 7,
  referenceDateStr?: string
): Promise<number> {
  const activeMeds = await Medication.find({
    userId,
    isActive: true,
  });

  let totalCreated = 0;
  for (const med of activeMeds) {
    totalCreated += await generateDosesForMedication(med, horizonDays, referenceDateStr);
  }

  return totalCreated;
}
