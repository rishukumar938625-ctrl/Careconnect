import { Router, Response } from 'express';
import { toSafeUser } from '../models/User.js';
import { authenticate, AuthRequest } from '../middleware/authMiddleware.js';
import { validateCsrf } from '../middleware/csrfMiddleware.js';

const router = Router();

// GET authenticated user profile
router.get('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ status: 'error', message: 'Not authenticated' });
      return;
    }
    res.status(200).json(toSafeUser(req.user));
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to fetch user profile' });
  }
});

// PUT update profile (only permitted fields)
router.put('/profile', authenticate, validateCsrf, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ status: 'error', message: 'Not authenticated' });
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

    if (name && typeof name === 'string') {
      if (name.trim().length >= 2 && name.trim().length <= 100) {
        user.name = name.trim();
      } else {
        res.status(400).json({ status: 'error', message: 'Name must be between 2 and 100 characters' });
        return;
      }
    }

    if (phone !== undefined && typeof phone === 'string') {
      user.phone = phone.trim();
    }

    if (dateOfBirth !== undefined && typeof dateOfBirth === 'string') {
      user.dateOfBirth = dateOfBirth;
    }

    if (bloodGroup !== undefined && typeof bloodGroup === 'string') {
      user.bloodGroup = bloodGroup.trim();
    }

    if (Array.isArray(allergies)) {
      user.allergies = allergies.filter((a) => typeof a === 'string');
    }

    if (Array.isArray(chronicConditions)) {
      user.chronicConditions = chronicConditions.filter((c) => typeof c === 'string');
    }

    if (emergencyContact && typeof emergencyContact === 'object') {
      user.emergencyContact = {
        name: typeof emergencyContact.name === 'string' ? emergencyContact.name : user.emergencyContact?.name || '',
        relationship: typeof emergencyContact.relationship === 'string' ? emergencyContact.relationship : user.emergencyContact?.relationship || '',
        phone: typeof emergencyContact.phone === 'string' ? emergencyContact.phone : user.emergencyContact?.phone || '',
      };
    }

    if (notificationPreferences && typeof notificationPreferences === 'object') {
      user.notificationPreferences = {
        ...user.notificationPreferences,
        ...notificationPreferences,
      };
    }

    await user.save();
    res.status(200).json(toSafeUser(user));
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to update user profile' });
  }
});

// PATCH toggle notifications
router.patch('/notifications', authenticate, validateCsrf, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ status: 'error', message: 'Not authenticated' });
      return;
    }

    user.notificationPreferences = {
      ...user.notificationPreferences,
      ...req.body,
    };

    await user.save();
    res.status(200).json(user.notificationPreferences);
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Failed to update notification preferences' });
  }
});

export default router;
