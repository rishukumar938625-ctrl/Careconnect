import { Response, NextFunction } from 'express';
import { toSafeUser } from '../models/User.js';
import { AuthRequest } from '../middleware/authMiddleware.js';
import {
  isValidTimeZone,
  isValidTimeStr,
  isQuietHoursOvernight,
  sanitizeHealthList,
} from '../utils/userValidation.js';

const PROTECTED_FIELDS = ['role', 'passwordHash', 'password', 'isActive', '_id', 'id'];

/**
 * GET /api/user/profile
 * Retrieve authenticated user profile with safe attributes.
 */
export const getProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }
    res.status(200).json(toSafeUser(req.user));
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/user/profile
 * Update permitted profile fields with strict allowlisting and validation.
 */
export const updateProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }

    // Explicitly reject attempts to change protected fields
    for (const field of PROTECTED_FIELDS) {
      if (req.body[field] !== undefined) {
        res.status(400).json({
          status: 'error',
          message: `Modifying protected field '${field}' is not permitted.`,
        });
        return;
      }
    }

    // Email change is not permitted through general profile update
    if (req.body.email !== undefined && req.body.email !== user.email) {
      res.status(400).json({
        status: 'error',
        message: 'Email address cannot be changed directly.',
      });
      return;
    }

    const {
      name,
      phone,
      dateOfBirth,
      bloodGroup,
      allergies,
      chronicConditions,
      emergencyContact,
      notificationPreferences,
    } = req.body;

    // Validate name
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
        res.status(400).json({
          status: 'error',
          message: 'Full name must be between 2 and 100 characters long.',
        });
        return;
      }
      user.name = name.trim();
    }

    // Phone
    if (phone !== undefined) {
      if (typeof phone === 'string') {
        user.phone = phone.trim().slice(0, 25);
      }
    }

    // Date of birth
    if (dateOfBirth !== undefined) {
      if (typeof dateOfBirth === 'string') {
        user.dateOfBirth = dateOfBirth.trim();
      }
    }

    // Blood group
    if (bloodGroup !== undefined) {
      if (typeof bloodGroup === 'string') {
        user.bloodGroup = bloodGroup.trim().slice(0, 10);
      }
    }

    // Allergies
    if (allergies !== undefined) {
      if (!Array.isArray(allergies)) {
        res.status(400).json({ status: 'error', message: 'Allergies must be an array of strings.' });
        return;
      }
      user.allergies = sanitizeHealthList(allergies, 30, 60);
    }

    // Chronic conditions
    if (chronicConditions !== undefined) {
      if (!Array.isArray(chronicConditions)) {
        res.status(400).json({ status: 'error', message: 'Chronic conditions must be an array of strings.' });
        return;
      }
      user.chronicConditions = sanitizeHealthList(chronicConditions, 30, 100);
    }

    // Emergency contact
    if (emergencyContact !== undefined) {
      if (typeof emergencyContact !== 'object' || emergencyContact === null) {
        res.status(400).json({ status: 'error', message: 'Emergency contact must be an object.' });
        return;
      }
      user.emergencyContact = {
        name: typeof emergencyContact.name === 'string' ? emergencyContact.name.trim().slice(0, 100) : user.emergencyContact?.name || '',
        relationship: typeof emergencyContact.relationship === 'string' ? emergencyContact.relationship.trim().slice(0, 50) : user.emergencyContact?.relationship || '',
        phone: typeof emergencyContact.phone === 'string' ? emergencyContact.phone.trim().slice(0, 25) : user.emergencyContact?.phone || '',
      };
    }

    // Notification preferences (if provided)
    if (notificationPreferences !== undefined) {
      if (typeof notificationPreferences !== 'object' || notificationPreferences === null) {
        res.status(400).json({ status: 'error', message: 'Notification preferences must be an object.' });
        return;
      }

      if (notificationPreferences.quietHoursStart !== undefined && !isValidTimeStr(notificationPreferences.quietHoursStart)) {
        res.status(400).json({ status: 'error', message: 'quietHoursStart must be in HH:MM format (00:00 - 23:59).' });
        return;
      }

      if (notificationPreferences.quietHoursEnd !== undefined && !isValidTimeStr(notificationPreferences.quietHoursEnd)) {
        res.status(400).json({ status: 'error', message: 'quietHoursEnd must be in HH:MM format (00:00 - 23:59).' });
        return;
      }

      if (notificationPreferences.timeZone !== undefined && !isValidTimeZone(notificationPreferences.timeZone)) {
        res.status(400).json({ status: 'error', message: 'Invalid IANA time zone identifier.' });
        return;
      }

      user.notificationPreferences = {
        ...user.notificationPreferences,
        ...notificationPreferences,
      };
    }

    await user.save();
    res.status(200).json(toSafeUser(user));
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/user/health-profile
 * Retrieve user's personal health information with non-diagnostic disclaimer.
 */
export const getHealthProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        bloodGroup: user.bloodGroup || '',
        allergies: user.allergies || [],
        chronicConditions: user.chronicConditions || [],
        emergencyContact: user.emergencyContact || { name: '', relationship: '', phone: '' },
        disclaimer: 'User-provided personal health information. Not a substitute for clinical records or professional diagnosis.',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/user/health-profile
 * Update user's personal health profile (allergies, conditions, emergency contact).
 */
export const updateHealthProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }

    const { bloodGroup, allergies, chronicConditions, emergencyContact } = req.body;

    if (bloodGroup !== undefined) {
      if (typeof bloodGroup === 'string') {
        user.bloodGroup = bloodGroup.trim().slice(0, 10);
      }
    }

    if (allergies !== undefined) {
      if (!Array.isArray(allergies)) {
        res.status(400).json({ status: 'error', message: 'Allergies must be an array of strings.' });
        return;
      }
      user.allergies = sanitizeHealthList(allergies, 30, 60);
    }

    if (chronicConditions !== undefined) {
      if (!Array.isArray(chronicConditions)) {
        res.status(400).json({ status: 'error', message: 'Chronic conditions must be an array of strings.' });
        return;
      }
      user.chronicConditions = sanitizeHealthList(chronicConditions, 30, 100);
    }

    if (emergencyContact !== undefined) {
      if (typeof emergencyContact !== 'object' || emergencyContact === null) {
        res.status(400).json({ status: 'error', message: 'Emergency contact must be an object.' });
        return;
      }
      user.emergencyContact = {
        name: typeof emergencyContact.name === 'string' ? emergencyContact.name.trim().slice(0, 100) : user.emergencyContact?.name || '',
        relationship: typeof emergencyContact.relationship === 'string' ? emergencyContact.relationship.trim().slice(0, 50) : user.emergencyContact?.relationship || '',
        phone: typeof emergencyContact.phone === 'string' ? emergencyContact.phone.trim().slice(0, 25) : user.emergencyContact?.phone || '',
      };
    }

    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Personal health profile updated successfully.',
      data: {
        bloodGroup: user.bloodGroup || '',
        allergies: user.allergies,
        chronicConditions: user.chronicConditions,
        emergencyContact: user.emergencyContact,
        disclaimer: 'User-provided personal health information. Not a substitute for clinical records or professional diagnosis.',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/user/health-profile/allergies
 * Add an allergy to the personal health profile.
 */
export const addAllergy = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }

    const { allergy } = req.body;
    if (!allergy || typeof allergy !== 'string' || !allergy.trim()) {
      res.status(400).json({ status: 'error', message: 'Allergy name is required.' });
      return;
    }

    const trimmed = allergy.trim();
    if (trimmed.length > 60) {
      res.status(400).json({ status: 'error', message: 'Allergy name cannot exceed 60 characters.' });
      return;
    }

    const existing = user.allergies || [];
    if (existing.length >= 30) {
      res.status(400).json({ status: 'error', message: 'Maximum limit of 30 allergies reached.' });
      return;
    }

    const exists = existing.some((a) => a.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      user.allergies = [...existing, trimmed];
      await user.save();
    }

    res.status(200).json({
      status: 'success',
      message: 'Allergy added successfully.',
      allergies: user.allergies,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/user/health-profile/allergies/:allergy
 * Remove an allergy from personal health profile.
 */
export const removeAllergy = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }

    const target = decodeURIComponent(req.params.allergy || '').trim().toLowerCase();
    if (!target) {
      res.status(400).json({ status: 'error', message: 'Allergy parameter is required.' });
      return;
    }

    user.allergies = (user.allergies || []).filter((a) => a.trim().toLowerCase() !== target);
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Allergy removed successfully.',
      allergies: user.allergies,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/user/health-profile/conditions
 * Add a chronic health condition to personal health profile.
 */
export const addCondition = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }

    const { condition } = req.body;
    if (!condition || typeof condition !== 'string' || !condition.trim()) {
      res.status(400).json({ status: 'error', message: 'Condition name is required.' });
      return;
    }

    const trimmed = condition.trim();
    if (trimmed.length > 100) {
      res.status(400).json({ status: 'error', message: 'Condition name cannot exceed 100 characters.' });
      return;
    }

    const existing = user.chronicConditions || [];
    if (existing.length >= 30) {
      res.status(400).json({ status: 'error', message: 'Maximum limit of 30 conditions reached.' });
      return;
    }

    const exists = existing.some((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      user.chronicConditions = [...existing, trimmed];
      await user.save();
    }

    res.status(200).json({
      status: 'success',
      message: 'Health condition added successfully.',
      chronicConditions: user.chronicConditions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/user/health-profile/conditions/:condition
 * Remove a chronic condition from personal health profile.
 */
export const removeCondition = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }

    const target = decodeURIComponent(req.params.condition || '').trim().toLowerCase();
    if (!target) {
      res.status(400).json({ status: 'error', message: 'Condition parameter is required.' });
      return;
    }

    user.chronicConditions = (user.chronicConditions || []).filter(
      (c) => c.trim().toLowerCase() !== target
    );
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Health condition removed successfully.',
      chronicConditions: user.chronicConditions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/user/notifications
 * Retrieve notification preferences and quiet hours details.
 */
export const getNotificationPreferences = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }

    const prefs = user.notificationPreferences || {
      medicationReminders: true,
      appointmentAlerts: true,
      healthTips: false,
      emailUpdates: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      timeZone: 'UTC',
    };

    const crossesMidnight = isQuietHoursOvernight(prefs.quietHoursStart, prefs.quietHoursEnd);

    res.status(200).json({
      status: 'success',
      data: {
        ...prefs,
        crossesMidnight,
        deliveryNotice:
          'Preferences are saved. Automated background notification delivery will be enabled in Phase 7.',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT/PATCH /api/user/notifications
 * Save notification preferences, quiet hours, and IANA timezone.
 */
export const updateNotificationPreferences = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ status: 'error', message: 'Authentication required.' });
      return;
    }

    const {
      medicationReminders,
      appointmentAlerts,
      healthTips,
      emailUpdates,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      timeZone,
    } = req.body;

    const current = user.notificationPreferences || {
      medicationReminders: true,
      appointmentAlerts: true,
      healthTips: false,
      emailUpdates: true,
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      timeZone: 'UTC',
    };

    // Validations
    if (quietHoursStart !== undefined) {
      if (!isValidTimeStr(quietHoursStart)) {
        res.status(400).json({
          status: 'error',
          message: 'quietHoursStart must be in HH:MM format (00:00 - 23:59).',
        });
        return;
      }
      current.quietHoursStart = quietHoursStart.trim();
    }

    if (quietHoursEnd !== undefined) {
      if (!isValidTimeStr(quietHoursEnd)) {
        res.status(400).json({
          status: 'error',
          message: 'quietHoursEnd must be in HH:MM format (00:00 - 23:59).',
        });
        return;
      }
      current.quietHoursEnd = quietHoursEnd.trim();
    }

    if (timeZone !== undefined) {
      if (!isValidTimeZone(timeZone)) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid IANA time zone identifier (e.g. UTC, America/New_York, Asia/Kolkata).',
        });
        return;
      }
      current.timeZone = timeZone.trim();
    }

    if (medicationReminders !== undefined) current.medicationReminders = Boolean(medicationReminders);
    if (appointmentAlerts !== undefined) current.appointmentAlerts = Boolean(appointmentAlerts);
    if (healthTips !== undefined) current.healthTips = Boolean(healthTips);
    if (emailUpdates !== undefined) current.emailUpdates = Boolean(emailUpdates);
    if (quietHoursEnabled !== undefined) current.quietHoursEnabled = Boolean(quietHoursEnabled);

    user.notificationPreferences = current;
    await user.save();

    const crossesMidnight = isQuietHoursOvernight(current.quietHoursStart, current.quietHoursEnd);

    res.status(200).json({
      status: 'success',
      message: 'Notification preferences updated successfully.',
      data: {
        ...current,
        crossesMidnight,
        deliveryNotice:
          'Preferences are saved. Automated background notification delivery will be enabled in Phase 7.',
      },
    });
  } catch (error) {
    next(error);
  }
};
