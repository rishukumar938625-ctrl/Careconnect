import { IDoctor } from '../models/Doctor.js';
import { IAppointment } from '../models/Appointment.js';

export interface SlotInfo {
  startAt: string;        // ISO 8601 UTC timestamp
  endAt: string;          // ISO 8601 UTC timestamp
  timeSlot: string;       // "09:00"
  displayTime: string;    // "09:00 AM"
  durationMinutes: number;
  available: boolean;
  unavailableReason?: 'booked' | 'past' | 'outside_notice' | 'blocked';
}

export interface DayAvailability {
  date: string;
  doctorId: string;
  doctorName: string;
  timezone: string;
  isWorkingDay: boolean;
  isBlocked: boolean;
  message?: string;
  slots: SlotInfo[];
  availableCount: number;
  totalSlots: number;
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Validates whether a string matches a strict YYYY-MM-DD calendar date.
 */
export function isValidDateStr(dateStr: string): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Parses time string (e.g. "09:00" or "14:30") into minutes from midnight.
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Formats minutes from midnight into 24h "HH:MM" and 12h "HH:MM AM/PM".
 */
export function formatMinutes(totalMinutes: number): { timeSlot: string; displayTime: string } {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const padH = String(hours24).padStart(2, '0');
  const padM = String(minutes).padStart(2, '0');
  const timeSlot = `${padH}:${padM}`;

  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  const padH12 = String(hours12).padStart(2, '0');
  const displayTime = `${padH12}:${padM} ${period}`;

  return { timeSlot, displayTime };
}

/**
 * Determines if two time windows overlap: [s1, e1) and [s2, e2)
 */
export function isOverlapping(s1: Date, e1: Date, s2: Date, e2: Date): boolean {
  return s1.getTime() < e2.getTime() && e1.getTime() > s2.getTime();
}

/**
 * Generates slots and evaluates availability for a given doctor on a given date.
 */
export function generateDoctorAvailability(
  doctor: IDoctor,
  dateStr: string,
  activeAppointments: IAppointment[],
  now: Date = new Date(),
  bookingHorizonDays = 60,
  minimumNoticeMinutes = 15
): DayAvailability {
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDateUtc = new Date(Date.UTC(year, month - 1, day));
  const dayName = DAYS_OF_WEEK[targetDateUtc.getUTCDay()];

  // Base response template
  const result: DayAvailability = {
    date: dateStr,
    doctorId: doctor._id.toString(),
    doctorName: doctor.name,
    timezone: doctor.timezone || 'UTC',
    isWorkingDay: true,
    isBlocked: false,
    slots: [],
    availableCount: 0,
    totalSlots: 0,
  };

  // Check booking horizon
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const msDiff = targetDateUtc.getTime() - todayUtc.getTime();
  const dayDiff = Math.floor(msDiff / (1000 * 60 * 60 * 24));

  if (dayDiff < 0) {
    result.isWorkingDay = false;
    result.message = 'Cannot view or book dates in the past.';
    return result;
  }

  if (dayDiff > bookingHorizonDays) {
    result.isWorkingDay = false;
    result.message = `Appointments can only be scheduled up to ${bookingHorizonDays} days in advance.`;
    return result;
  }

  // Check blocked dates
  if (doctor.blockedDates && doctor.blockedDates.includes(dateStr)) {
    result.isBlocked = true;
    result.message = 'Doctor is unavailable on this date.';
    return result;
  }

  // Check working days
  const workingDays =
    doctor.workingDays && doctor.workingDays.length > 0
      ? doctor.workingDays
      : doctor.availableDays && doctor.availableDays.length > 0
      ? doctor.availableDays
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  const isWorkingDay = workingDays.some(
    (d) => d.toLowerCase() === dayName.toLowerCase()
  );

  if (!isWorkingDay) {
    result.isWorkingDay = false;
    result.message = `Doctor does not consult on ${dayName}s.`;
    return result;
  }

  // Working hours and slot duration
  const startStr = doctor.workingHours?.start || '09:00';
  const endStr = doctor.workingHours?.end || '17:00';
  const startMinutes = parseTimeToMinutes(startStr);
  const endMinutes = parseTimeToMinutes(endStr);
  const duration = doctor.consultationDurationMinutes || 30;

  const minimumNoticeTime = now.getTime() + minimumNoticeMinutes * 60 * 1000;
  const slots: SlotInfo[] = [];

  for (let currentMin = startMinutes; currentMin + duration <= endMinutes; currentMin += duration) {
    const endSlotMin = currentMin + duration;
    const { timeSlot, displayTime } = formatMinutes(currentMin);

    const slotStart = new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        Math.floor(currentMin / 60),
        currentMin % 60,
        0,
        0
      )
    );

    const slotEnd = new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        Math.floor(endSlotMin / 60),
        endSlotMin % 60,
        0,
        0
      )
    );

    let isAvailable = true;
    let unavailableReason: SlotInfo['unavailableReason'] = undefined;

    // Check past or insufficient notice
    if (slotStart.getTime() <= minimumNoticeTime) {
      isAvailable = false;
      unavailableReason = slotStart.getTime() <= now.getTime() ? 'past' : 'outside_notice';
    }

    // Check overlap with active appointments
    if (isAvailable) {
      const hasConflict = activeAppointments.some((appt) => {
        const apptStart = new Date(appt.startAt);
        const apptEnd = new Date(appt.endAt);
        return isOverlapping(slotStart, slotEnd, apptStart, apptEnd);
      });

      if (hasConflict) {
        isAvailable = false;
        unavailableReason = 'booked';
      }
    }

    slots.push({
      startAt: slotStart.toISOString(),
      endAt: slotEnd.toISOString(),
      timeSlot,
      displayTime,
      durationMinutes: duration,
      available: isAvailable,
      unavailableReason,
    });
  }

  result.slots = slots;
  result.totalSlots = slots.length;
  result.availableCount = slots.filter((s) => s.available).length;

  return result;
}
