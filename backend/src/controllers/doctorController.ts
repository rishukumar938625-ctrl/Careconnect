import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Doctor } from '../models/Doctor.js';
import { Appointment } from '../models/Appointment.js';
import { escapeRegex, parsePagination, buildPaginationMeta } from '../utils/queryHelper.js';
import { isValidDateStr, generateDoctorAvailability } from '../utils/availability.js';

/**
 * GET /api/doctors
 * Public listing of doctors with pagination, search, and specialty filtering.
 */
export const getDoctors = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { specialty, q, activeOnly } = req.query;
    const { page, limit, skip } = parsePagination(req);
    const filter: Record<string, unknown> = {};

    // Filter by active status (default true)
    if (activeOnly !== 'false') {
      filter.isActive = true;
    }

    // Filter by specialty
    if (specialty && typeof specialty === 'string' && specialty !== 'All') {
      filter.specialty = new RegExp(`^${escapeRegex(specialty.trim())}$`, 'i');
    }

    // Keyword search across name, specialty, qualifications, hospital, bio
    if (q && typeof q === 'string' && q.trim()) {
      const searchRegex = new RegExp(escapeRegex(q.trim()), 'i');
      filter.$or = [
        { name: searchRegex },
        { specialty: searchRegex },
        { qualifications: searchRegex },
        { hospital: searchRegex },
        { bio: searchRegex },
        { about: searchRegex },
      ];
    }

    const [doctors, total] = await Promise.all([
      Doctor.find(filter)
        .sort({ rating: -1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Doctor.countDocuments(filter),
    ]);

    res.status(200).json({
      data: doctors,
      pagination: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doctors/:id
 * Retrieve public details for a single doctor by Mongo ID or slug.
 */
export const getDoctorById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    let doctor = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      doctor = await Doctor.findById(id).lean();
    }
    if (!doctor) {
      doctor = await Doctor.findOne({ slug: id }).lean();
    }

    if (!doctor || !doctor.isActive) {
      res.status(404).json({
        status: 'error',
        message: 'Doctor not found or currently unavailable.',
      });
      return;
    }

    res.status(200).json(doctor);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doctors/:id/availability?date=YYYY-MM-DD
 * Returns real-time available appointment slots for a doctor on a specific date.
 */
export const getDoctorAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date || typeof date !== 'string' || !isValidDateStr(date)) {
      res.status(400).json({
        status: 'error',
        message: 'A valid date in YYYY-MM-DD format is required in the query parameter (?date=YYYY-MM-DD).',
      });
      return;
    }

    let doctor = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      doctor = await Doctor.findById(id);
    }
    if (!doctor) {
      doctor = await Doctor.findOne({ slug: id });
    }

    if (!doctor || !doctor.isActive) {
      res.status(404).json({
        status: 'error',
        message: 'Doctor not found or currently unavailable.',
      });
      return;
    }

    // Query active appointments on that calendar day (startOfDay to endOfDay in UTC)
    const [year, month, day] = date.split('-').map(Number);
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const activeAppointments = await Appointment.find({
      doctorId: doctor._id,
      status: { $in: ['booked', 'upcoming', 'rescheduled'] },
      startAt: { $lt: endOfDay },
      endAt: { $gt: startOfDay },
    });

    const availability = generateDoctorAvailability(
      doctor,
      date,
      activeAppointments,
      new Date(),
      60, // 60 days booking horizon
      15  // 15 minutes minimum notice
    );

    res.status(200).json({
      status: 'success',
      data: availability,
    });
  } catch (error) {
    next(error);
  }
};
