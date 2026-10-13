import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Appointment, IAppointment } from '../models/Appointment.js';
import { Doctor } from '../models/Doctor.js';
import { AuthRequest } from '../middleware/authMiddleware.js';
import { parsePagination, buildPaginationMeta } from '../utils/queryHelper.js';
import {
  isValidDateStr,
  parseTimeToMinutes,
  formatMinutes,
  isOverlapping,
} from '../utils/availability.js';
import {
  scheduleAppointmentReminders,
  rescheduleAppointmentReminders,
  cancelAppointmentReminders,
} from '../services/notificationScheduler.js';

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
 * Helper to validate slot parameters against doctor schedule.
 */
function validateSlotSchedule(
  doctor: any,
  slotStart: Date,
  slotEnd: Date,
  dateStr: string,
  now: Date = new Date(),
  bookingHorizonDays = 60
): { valid: boolean; message?: string } {
  if (slotStart.getTime() <= now.getTime()) {
    return { valid: false, message: 'Cannot book appointments in the past.' };
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDateUtc = new Date(Date.UTC(year, month - 1, day));
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayDiff = Math.floor((targetDateUtc.getTime() - todayUtc.getTime()) / (1000 * 60 * 60 * 24));

  if (dayDiff > bookingHorizonDays) {
    return {
      valid: false,
      message: `Appointments can only be scheduled up to ${bookingHorizonDays} days in advance.`,
    };
  }

  if (doctor.blockedDates && doctor.blockedDates.includes(dateStr)) {
    return { valid: false, message: 'Doctor is unavailable on this date.' };
  }

  const dayName = DAYS_OF_WEEK[targetDateUtc.getUTCDay()];
  const workingDays =
    doctor.workingDays?.length > 0
      ? doctor.workingDays
      : doctor.availableDays?.length > 0
      ? doctor.availableDays
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  if (!workingDays.some((d: string) => d.toLowerCase() === dayName.toLowerCase())) {
    return { valid: false, message: `Doctor does not consult on ${dayName}s.` };
  }

  const startStr = doctor.workingHours?.start || '09:00';
  const endStr = doctor.workingHours?.end || '17:00';
  const doctorStartMin = parseTimeToMinutes(startStr);
  const doctorEndMin = parseTimeToMinutes(endStr);

  const slotStartMin = slotStart.getUTCHours() * 60 + slotStart.getUTCMinutes();
  const slotEndMin = slotEnd.getUTCHours() * 60 + slotEnd.getUTCMinutes();

  if (slotStartMin < doctorStartMin || slotEndMin > doctorEndMin) {
    return {
      valid: false,
      message: `Requested slot is outside doctor working hours (${startStr} - ${endStr}).`,
    };
  }

  return { valid: true };
}

/**
 * POST /api/appointments
 * Book a new appointment for the authenticated user.
 */
export const bookAppointment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }

    const {
      doctorId,
      startAt: rawStartAt,
      date: rawDate,
      timeSlot: rawTimeSlot,
      type = 'in-person',
      reason,
      notes,
    } = req.body;

    if (!doctorId) {
      res.status(400).json({ status: 'error', message: 'Doctor ID is required.' });
      return;
    }

    // Resolve doctor by ID or slug
    let doctor = null;
    if (mongoose.Types.ObjectId.isValid(doctorId)) {
      doctor = await Doctor.findById(doctorId);
    }
    if (!doctor) {
      doctor = await Doctor.findOne({ slug: doctorId });
    }

    if (!doctor || !doctor.isActive) {
      res.status(404).json({
        status: 'error',
        message: 'Doctor not found or currently unavailable for booking.',
      });
      return;
    }

    // Determine startAt and endAt
    let slotStart: Date;
    let dateStr = rawDate;
    let timeSlotStr = rawTimeSlot;

    if (rawStartAt) {
      slotStart = new Date(rawStartAt);
      if (isNaN(slotStart.getTime())) {
        res.status(400).json({ status: 'error', message: 'Invalid startAt date format.' });
        return;
      }
      const y = slotStart.getUTCFullYear();
      const m = String(slotStart.getUTCMonth() + 1).padStart(2, '0');
      const d = String(slotStart.getUTCDate()).padStart(2, '0');
      dateStr = `${y}-${m}-${d}`;
      const { timeSlot } = formatMinutes(slotStart.getUTCHours() * 60 + slotStart.getUTCMinutes());
      timeSlotStr = timeSlot;
    } else if (rawDate && rawTimeSlot) {
      if (!isValidDateStr(rawDate)) {
        res.status(400).json({ status: 'error', message: 'Invalid date format. Expected YYYY-MM-DD.' });
        return;
      }
      const [year, month, day] = rawDate.split('-').map(Number);
      const [hours, minutes] = rawTimeSlot.split(':').map(Number);
      slotStart = new Date(Date.UTC(year, month - 1, day, hours || 0, minutes || 0, 0, 0));
      if (isNaN(slotStart.getTime())) {
        res.status(400).json({ status: 'error', message: 'Invalid time format. Expected HH:MM.' });
        return;
      }
    } else {
      res.status(400).json({
        status: 'error',
        message: 'Appointment time must be specified (startAt timestamp or date and timeSlot).',
      });
      return;
    }

    const duration = doctor.consultationDurationMinutes || 30;
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

    // Backend validation of doctor schedule & rules
    const scheduleCheck = validateSlotSchedule(doctor, slotStart, slotEnd, dateStr);
    if (!scheduleCheck.valid) {
      res.status(400).json({ status: 'error', message: scheduleCheck.message });
      return;
    }

    // Pre-check for overlapping active appointments
    const existingConflict = await Appointment.findOne({
      doctorId: doctor._id,
      status: { $in: ['booked', 'upcoming', 'rescheduled'] },
      startAt: { $lt: slotEnd },
      endAt: { $gt: slotStart },
    });

    if (existingConflict) {
      res.status(409).json({
        status: 'error',
        message: 'This appointment slot is already booked. Please choose another time.',
      });
      return;
    }

    // Sanitize reason length (max 250 characters)
    const sanitizedReason = typeof reason === 'string' ? reason.trim().slice(0, 250) : undefined;
    const sanitizedNotes = typeof notes === 'string' ? notes.trim().slice(0, 500) : undefined;
    const appointmentType = type === 'video' ? 'video' : 'in-person';

    const newAppointment = new Appointment({
      patientId: req.user._id,
      doctorId: doctor._id,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialty,
      doctorAvatar: doctor.avatarUrl || doctor.avatarInitials,
      patientName: req.user.name,
      patientPhone: req.user.phone || '',
      patientEmail: req.user.email,
      startAt: slotStart,
      endAt: slotEnd,
      timezone: doctor.timezone || 'UTC',
      date: dateStr,
      timeSlot: timeSlotStr,
      type: appointmentType,
      status: 'booked',
      reason: sanitizedReason,
      notes: sanitizedNotes,
      hospital: doctor.hospital || 'CareConnect Partner Clinic',
    });

    try {
      await newAppointment.save();
    } catch (saveError: any) {
      // MongoDB E11000 unique compound index collision (concurrent race condition prevention)
      if (saveError?.code === 11000) {
        res.status(409).json({
          status: 'error',
          message: 'This time slot was just booked by another patient. Please choose another slot.',
        });
        return;
      }
      throw saveError;
    }

    // Schedule appointment reminders (24h and 1h)
    await scheduleAppointmentReminders(newAppointment);

    res.status(201).json(newAppointment);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/appointments
 * List authenticated user's appointments with optional status filter.
 */
export const getAppointments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }

    const { status } = req.query;
    const filter: Record<string, unknown> = {
      patientId: req.user._id,
    };

    if (status && typeof status === 'string') {
      if (status === 'upcoming') {
        filter.status = { $in: ['booked', 'upcoming'] };
      } else if (status === 'past') {
        filter.status = { $in: ['completed', 'cancelled', 'rescheduled'] };
      } else {
        filter.status = status;
      }
    }

    const appointments = await Appointment.find(filter)
      .sort({ startAt: 1 })
      .lean();

    res.status(200).json(appointments);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/appointments/history
 * Paginated historical appointments for authenticated user.
 */
export const getAppointmentHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }

    const { page, limit, skip } = parsePagination(req);
    const filter = { patientId: req.user._id };

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .sort({ startAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Appointment.countDocuments(filter),
    ]);

    res.status(200).json({
      data: appointments,
      pagination: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/appointments/:id
 * Retrieve a single appointment owned by the authenticated user.
 */
export const getAppointmentById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({ status: 'error', message: 'Appointment not found.' });
      return;
    }

    const appointment = await Appointment.findOne({
      _id: id,
      patientId: req.user._id,
    }).lean();

    if (!appointment) {
      res.status(404).json({ status: 'error', message: 'Appointment not found.' });
      return;
    }

    res.status(200).json(appointment);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/appointments/:id/reschedule
 * Reschedule an owned appointment to a new available slot.
 */
export const rescheduleAppointment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({ status: 'error', message: 'Appointment not found.' });
      return;
    }

    const appointment = await Appointment.findOne({
      _id: id,
      patientId: req.user._id,
    });

    if (!appointment) {
      res.status(404).json({ status: 'error', message: 'Appointment not found.' });
      return;
    }

    // Validate current status
    if (appointment.status === 'cancelled') {
      res.status(400).json({
        status: 'error',
        message: 'Cannot reschedule a cancelled appointment.',
      });
      return;
    }

    if (appointment.status === 'completed') {
      res.status(400).json({
        status: 'error',
        message: 'Cannot reschedule a completed appointment.',
      });
      return;
    }

    const {
      startAt: rawStartAt,
      date: rawDate,
      timeSlot: rawTimeSlot,
      reason,
    } = req.body;

    const doctor = await Doctor.findById(appointment.doctorId);
    if (!doctor || !doctor.isActive) {
      res.status(400).json({
        status: 'error',
        message: 'Doctor is no longer active for rescheduling.',
      });
      return;
    }

    let slotStart: Date;
    let dateStr = rawDate;
    let timeSlotStr = rawTimeSlot;

    if (rawStartAt) {
      slotStart = new Date(rawStartAt);
      if (isNaN(slotStart.getTime())) {
        res.status(400).json({ status: 'error', message: 'Invalid startAt date format.' });
        return;
      }
      const y = slotStart.getUTCFullYear();
      const m = String(slotStart.getUTCMonth() + 1).padStart(2, '0');
      const d = String(slotStart.getUTCDate()).padStart(2, '0');
      dateStr = `${y}-${m}-${d}`;
      const { timeSlot } = formatMinutes(slotStart.getUTCHours() * 60 + slotStart.getUTCMinutes());
      timeSlotStr = timeSlot;
    } else if (rawDate && rawTimeSlot) {
      if (!isValidDateStr(rawDate)) {
        res.status(400).json({ status: 'error', message: 'Invalid date format. Expected YYYY-MM-DD.' });
        return;
      }
      const [year, month, day] = rawDate.split('-').map(Number);
      const [hours, minutes] = rawTimeSlot.split(':').map(Number);
      slotStart = new Date(Date.UTC(year, month - 1, day, hours || 0, minutes || 0, 0, 0));
      if (isNaN(slotStart.getTime())) {
        res.status(400).json({ status: 'error', message: 'Invalid time format. Expected HH:MM.' });
        return;
      }
    } else {
      res.status(400).json({
        status: 'error',
        message: 'New appointment time must be specified (startAt timestamp or date and timeSlot).',
      });
      return;
    }

    const duration = doctor.consultationDurationMinutes || 30;
    const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

    const scheduleCheck = validateSlotSchedule(doctor, slotStart, slotEnd, dateStr);
    if (!scheduleCheck.valid) {
      res.status(400).json({ status: 'error', message: scheduleCheck.message });
      return;
    }

    // Overlap check against other active appointments (excluding current appointment)
    const conflict = await Appointment.findOne({
      _id: { $ne: appointment._id },
      doctorId: doctor._id,
      status: { $in: ['booked', 'upcoming', 'rescheduled'] },
      startAt: { $lt: slotEnd },
      endAt: { $gt: slotStart },
    });

    if (conflict) {
      res.status(409).json({
        status: 'error',
        message: 'The requested reschedule slot is already booked. Please choose another time.',
      });
      return;
    }

    appointment.startAt = slotStart;
    appointment.endAt = slotEnd;
    appointment.date = dateStr;
    appointment.timeSlot = timeSlotStr;
    appointment.status = 'booked';
    if (reason && typeof reason === 'string') {
      appointment.reason = reason.trim().slice(0, 250);
    }

    try {
      await appointment.save();
    } catch (saveError: any) {
      if (saveError?.code === 11000) {
        res.status(409).json({
          status: 'error',
          message: 'The requested slot was just booked by another user. Please choose another slot.',
        });
        return;
      }
      throw saveError;
    }

    // Invalidate old reminder jobs and schedule for new time
    await rescheduleAppointmentReminders(appointment);

    res.status(200).json({
      message: 'Appointment rescheduled successfully',
      appointment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/appointments/:id/cancel
 * Cancel an owned appointment.
 */
export const cancelAppointment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(404).json({ status: 'error', message: 'Appointment not found.' });
      return;
    }

    const appointment = await Appointment.findOne({
      _id: id,
      patientId: req.user._id,
    });

    if (!appointment) {
      res.status(404).json({ status: 'error', message: 'Appointment not found.' });
      return;
    }

    if (appointment.status === 'cancelled') {
      res.status(400).json({
        status: 'error',
        message: 'This appointment is already cancelled.',
      });
      return;
    }

    if (appointment.status === 'completed') {
      res.status(400).json({
        status: 'error',
        message: 'Cannot cancel an appointment that has already been completed.',
      });
      return;
    }

    const { cancellationReason } = req.body || {};
    appointment.status = 'cancelled';
    if (cancellationReason && typeof cancellationReason === 'string') {
      appointment.cancellationReason = cancellationReason.trim().slice(0, 250);
    }

    await appointment.save();

    // Cancel pending notification reminder jobs for this appointment
    await cancelAppointmentReminders(appointment._id);

    res.status(200).json({
      message: 'Appointment cancelled successfully',
      appointment,
    });
  } catch (error) {
    next(error);
  }
};
