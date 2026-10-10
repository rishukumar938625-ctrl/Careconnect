import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { DoseRecord } from '../models/DoseRecord.js';
import { Medication } from '../models/Medication.js';
import { AuthRequest } from '../middleware/authMiddleware.js';
import { generateDosesForUser, formatDateStr } from '../utils/scheduler.js';
import { parsePagination, buildPaginationMeta } from '../utils/queryHelper.js';

/**
 * GET /api/doses/today
 * Returns today's scheduled doses for the authenticated user, populated with medication info.
 */
export const getTodayDoses = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required' });
      return;
    }

    const todayStr = formatDateStr(new Date());

    // Idempotently ensure doses for today and the next 3 days are populated
    await generateDosesForUser(req.user._id, 3, todayStr);

    const doses = await DoseRecord.find({
      userId: req.user._id,
      scheduledDate: todayStr,
    })
      .populate('medicationId', 'name dosage form instructions color reminderEnabled')
      .sort({ scheduledTime: 1 });

    // Filter out any orphaned doses where the medication no longer exists
    const validDoses = doses.filter((d) => d.medicationId != null);

    res.status(200).json(validDoses);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doses/history
 * Paginated dose history for the authenticated user.
 */
export const getDoseHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required' });
      return;
    }

    const { page, limit, skip } = parsePagination(req);
    const { status, from, to, medicationId } = req.query;

    const filter: Record<string, unknown> = {
      userId: req.user._id,
    };

    if (status && ['pending', 'taken', 'skipped', 'snoozed'].includes(String(status))) {
      filter.status = status;
    }

    if (medicationId && mongoose.Types.ObjectId.isValid(String(medicationId))) {
      filter.medicationId = medicationId;
    }

    if (from || to) {
      const dateFilter: Record<string, string> = {};
      if (from && /^\d{4}-\d{2}-\d{2}$/.test(String(from))) {
        dateFilter.$gte = String(from);
      }
      if (to && /^\d{4}-\d{2}-\d{2}$/.test(String(to))) {
        dateFilter.$lte = String(to);
      }
      filter.scheduledDate = dateFilter;
    }

    const [doses, total] = await Promise.all([
      DoseRecord.find(filter)
        .populate('medicationId', 'name dosage form instructions color')
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DoseRecord.countDocuments(filter),
    ]);

    res.status(200).json({
      data: doses,
      pagination: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/doses/:id/status
 * Update status of an owned dose record (taken, skipped, snoozed, pending).
 */
export const updateDoseStatus = async (
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
      res.status(400).json({ status: 'error', message: 'Invalid dose ID format' });
      return;
    }

    const { status, snoozedUntil, snoozeMinutes } = req.body;

    if (!['pending', 'taken', 'skipped', 'snoozed'].includes(status)) {
      res.status(400).json({
        status: 'error',
        message: "Status must be 'pending', 'taken', 'skipped', or 'snoozed'",
      });
      return;
    }

    // Verify ownership: dose must belong to the authenticated user
    const dose = await DoseRecord.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!dose) {
      res.status(404).json({
        status: 'error',
        message: 'Dose record not found or not accessible',
      });
      return;
    }

    // Also verify the associated medication belongs to the authenticated user
    const medication = await Medication.findOne({
      _id: dose.medicationId,
      userId: req.user._id,
    });

    if (!medication) {
      res.status(404).json({
        status: 'error',
        message: 'Associated medication record not accessible',
      });
      return;
    }

    const now = new Date();

    if (status === 'taken') {
      dose.status = 'taken';
      dose.takenAt = now;
      dose.snoozedUntil = undefined;
    } else if (status === 'skipped') {
      dose.status = 'skipped';
      dose.takenAt = undefined;
      dose.snoozedUntil = undefined;
    } else if (status === 'pending') {
      dose.status = 'pending';
      dose.takenAt = undefined;
      dose.snoozedUntil = undefined;
    } else if (status === 'snoozed') {
      let snoozeDate: Date;

      if (snoozedUntil) {
        snoozeDate = new Date(snoozedUntil);
        if (isNaN(snoozeDate.getTime())) {
          res.status(400).json({
            status: 'error',
            message: 'Invalid snoozedUntil timestamp format',
          });
          return;
        }
      } else if (snoozeMinutes && typeof snoozeMinutes === 'number' && snoozeMinutes > 0) {
        snoozeDate = new Date(now.getTime() + snoozeMinutes * 60 * 1000);
      } else {
        // Default snooze 30 minutes
        snoozeDate = new Date(now.getTime() + 30 * 60 * 1000);
      }

      // Reject past snooze times
      if (snoozeDate <= now) {
        res.status(400).json({
          status: 'error',
          message: 'snoozedUntil must be in the future',
        });
        return;
      }

      // Cap maximum snooze to 24 hours to prevent unbounded postponement
      const maxSnooze = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      if (snoozeDate > maxSnooze) {
        res.status(400).json({
          status: 'error',
          message: 'Doses cannot be snoozed more than 24 hours into the future',
        });
        return;
      }

      dose.status = 'snoozed';
      dose.snoozedUntil = snoozeDate;
    }

    await dose.save();
    await dose.populate('medicationId', 'name dosage form instructions color');

    res.status(200).json(dose);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/doses/adherence
 * Calculate adherence statistics from actual stored dose records for the authenticated user.
 */
export const getAdherenceStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required' });
      return;
    }

    const now = new Date();

    // Query doses scheduled on or before the current timestamp (excludes future doses)
    const pastDoses = await DoseRecord.find({
      userId: req.user._id,
      scheduledAt: { $lte: now },
    }).sort({ scheduledDate: 1 });

    const totalScheduled = pastDoses.length;
    let takenDoses = 0;
    let skippedDoses = 0;
    let missedDoses = 0; // Past doses still marked pending

    for (const dose of pastDoses) {
      if (dose.status === 'taken') takenDoses++;
      else if (dose.status === 'skipped') skippedDoses++;
      else if (dose.status === 'pending' || dose.status === 'snoozed') missedDoses++;
    }

    const adherenceRate = totalScheduled > 0
      ? Math.round((takenDoses / totalScheduled) * 100)
      : 100;

    // Calculate current streak of consecutive days where all scheduled doses were taken
    // Group doses by scheduledDate
    const dateMap = new Map<string, { total: number; taken: number }>();
    for (const dose of pastDoses) {
      const entry = dateMap.get(dose.scheduledDate) || { total: 0, taken: 0 };
      entry.total++;
      if (dose.status === 'taken') entry.taken++;
      dateMap.set(dose.scheduledDate, entry);
    }

    const sortedDates = Array.from(dateMap.keys()).sort().reverse();
    let currentStreak = 0;
    for (const d of sortedDates) {
      const entry = dateMap.get(d)!;
      if (entry.total > 0 && entry.taken === entry.total) {
        currentStreak++;
      } else {
        break;
      }
    }

    res.status(200).json({
      totalScheduled,
      takenDoses,
      skippedDoses,
      missedDoses,
      adherenceRate,
      currentStreak,
      period: 'All-time past scheduled doses to date',
    });
  } catch (error) {
    next(error);
  }
};
