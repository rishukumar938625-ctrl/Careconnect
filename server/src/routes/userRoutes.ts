import { Router, Request, Response } from 'express';
import { User } from '../models/User.js';

const router = Router();

// GET default / logged-in user profile
router.get('/profile', async (_req: Request, res: Response) => {
  try {
    let user = await User.findOne();
    if (!user) {
      // Seed default profile if not exists
      user = new User({
        name: 'Rishu Kumar',
        email: 'rishu@careconnect.app',
        phone: '+91 98765 43210',
        dateOfBirth: '1998-05-14',
        bloodGroup: 'O+',
        allergies: ['Penicillin', 'Peanuts'],
        chronicConditions: ['Mild Asthma'],
        emergencyContact: {
          name: 'Rajesh Kumar',
          relationship: 'Brother',
          phone: '+91 98765 43211',
        },
        notificationPreferences: {
          medicationReminders: true,
          appointmentAlerts: true,
          healthTips: false,
          emailUpdates: true,
        },
      });
      await user.save();
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// PUT update profile
router.put('/profile', async (req: Request, res: Response) => {
  try {
    let user = await User.findOne();
    if (!user) {
      user = new User(req.body);
    } else {
      Object.assign(user, req.body);
    }
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// PATCH toggle notifications
router.patch('/notifications', async (req: Request, res: Response) => {
  try {
    const user = await User.findOne();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    user.notificationPreferences = {
      ...user.notificationPreferences,
      ...req.body,
    };
    await user.save();
    res.json(user.notificationPreferences);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

export default router;
