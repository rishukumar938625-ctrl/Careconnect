import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Medication, IMedication } from '../models/Medication.js';
import { DoseRecord } from '../models/DoseRecord.js';
import { AuthRequest } from '../middleware/authMiddleware.js';
import { generateDosesForMedication, formatDateStr } from '../utils/scheduler.js';

/**
 * GET /api/medications
 * List the authenticated user's active medications.
 */
export const getMedications = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required' });
      return;
    }

    const medications = await Medication.find({
      userId: req.user._id,
      isActive: true,
    }).sort({ createdAt: -1 });

    res.status(200).json(medications);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/medications
 * Add a new medication for the authenticated user.
 */
export const createMedication = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required' });
      return;
    }

    const {
      name,
      dosage,
      form,
      frequency,
      timesOfDay,
      times,
      startDate,
      endDate,
      instructions,
      timezone,
      reminderEnabled,
      color,
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ status: 'error', message: 'Medication name is required' });
      return;
    }

    if (!dosage || typeof dosage !== 'string' || !dosage.trim()) {
      res.status(400).json({ status: 'error', message: 'Prescribed dosage is required' });
      return;
    }

    if (!startDate || typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      res.status(400).json({ status: 'error', message: 'Valid startDate in YYYY-MM-DD format is required' });
      return;
    }

    if (endDate && (typeof endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate)) {
      res.status(400).json({ status: 'error', message: 'endDate must be in YYYY-MM-DD format and on or after startDate' });
      return;
    }

    // Support both timesOfDay and legacy times field
    const scheduledTimes: string[] = Array.isArray(timesOfDay) && timesOfDay.length > 0
      ? timesOfDay
      : Array.isArray(times) && times.length > 0
      ? times
      : ['08:00'];

    for (const t of scheduledTimes) {
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(t)) {
        res.status(400).json({ status: 'error', message: `Invalid time format '${t}'. Must be HH:MM in 24-hour format` });
        return;
      }
    }

    const medication = new Medication({
      userId: req.user._id,
      name: name.trim(),
      dosage: dosage.trim(),
      form: form || 'tablet',
      frequency: frequency || 'once_daily',
      timesOfDay: scheduledTimes,
      startDate,
      endDate: endDate || undefined,
      instructions: instructions ? instructions.trim() : '',
      timezone: timezone ? timezone.trim() : 'UTC',
      reminderEnabled: reminderEnabled !== undefined ? Boolean(reminderEnabled) : true,
      color: color || '#2563EB',
      isActive: true,
    });

    await medication.save();

    // Automatically generate doses within bounded 7-day horizon
    await generateDosesForMedication(medication, 7);

    res.status(201).json(medication);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/medications/:id
 * Retrieve a single medication owned by the authenticated user.
 */
export const getMedicationById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ status: 'error', message: 'Invalid medication ID format' });
      return;
    }

    // Enforce strict ownership: never return another user's record
    const medication = await Medication.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!medication) {
      res.status(404).json({ status: 'error', message: 'Medication not found or not accessible' });
      return;
    }

    res.status(200).json(medication);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/medications/:id
 * Update an owned medication and update future schedule without rewriting past history.
 */
export const updateMedication = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ status: 'error', message: 'Invalid medication ID format' });
      return;
    }

    const medication = await Medication.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!medication) {
      res.status(404).json({ status: 'error', message: 'Medication not found or not accessible' });
      return;
    }

    const {
      name,
      dosage,
      form,
      frequency,
      timesOfDay,
      times,
      startDate,
      endDate,
      instructions,
      timezone,
      reminderEnabled,
      color,
    } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ status: 'error', message: 'Medication name cannot be empty' });
        return;
      }
      medication.name = name.trim();
    }

    if (dosage !== undefined) {
      if (typeof dosage !== 'string' || !dosage.trim()) {
        res.status(400).json({ status: 'error', message: 'Dosage cannot be empty' });
        return;
      }
      medication.dosage = dosage.trim();
    }

    if (form !== undefined) medication.form = form;
    if (frequency !== undefined) medication.frequency = frequency;

    const newTimes = Array.isArray(timesOfDay) && timesOfDay.length > 0
      ? timesOfDay
      : Array.isArray(times) && times.length > 0
      ? times
      : undefined;

    if (newTimes) {
      for (const t of newTimes) {
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(t)) {
          res.status(400).json({ status: 'error', message: `Invalid time format '${t}'` });
          return;
        }
      }
      medication.timesOfDay = newTimes;
    }

    if (startDate !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        res.status(400).json({ status: 'error', message: 'startDate must be in YYYY-MM-DD format' });
        return;
      }
      medication.startDate = startDate;
    }

    if (endDate !== undefined) {
      if (endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < medication.startDate)) {
        res.status(400).json({ status: 'error', message: 'endDate must be in YYYY-MM-DD format and on or after startDate' });
        return;
      }
      medication.endDate = endDate || undefined;
    }

    if (instructions !== undefined) medication.instructions = instructions ? String(instructions).trim() : '';
    if (timezone !== undefined) medication.timezone = String(timezone).trim();
    if (reminderEnabled !== undefined) medication.reminderEnabled = Boolean(reminderEnabled);
    if (color !== undefined) medication.color = String(color);

    await medication.save();

    // Regenerate upcoming doses starting from today
    await generateDosesForMedication(medication, 7);

    res.status(200).json(medication);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/medications/:id
 * Safely archive/deactivate an owned medication while preserving historical dose records.
 */
export const deleteMedication = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ status: 'error', message: 'Invalid medication ID format' });
      return;
    }

    const medication = await Medication.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!medication) {
      res.status(404).json({ status: 'error', message: 'Medication not found or not accessible' });
      return;
    }

    // Soft delete/archive to keep historical dose records safe
    medication.isActive = false;
    await medication.save();

    // Clean up future pending doses after today
    const todayStr = formatDateStr(new Date());
    await DoseRecord.deleteMany({
      medicationId: medication._id,
      userId: req.user._id,
      scheduledDate: { $gt: todayStr },
      status: 'pending',
    });

    res.status(200).json({
      status: 'success',
      message: 'Medication archived successfully. Historical records preserved.',
    });
  } catch (error) {
    next(error);
  }
};
