import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  getHealthProfile,
  updateHealthProfile,
  addAllergy,
  removeAllergy,
  addCondition,
  removeCondition,
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateCsrf } from '../middleware/csrfMiddleware.js';

const router = Router();

// ─── User Profile Routes ───────────────────────────────────────────────────────
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, validateCsrf, updateProfile);

// ─── Personal Health Profile Routes ───────────────────────────────────────────
router.get('/health-profile', authenticate, getHealthProfile);
router.put('/health-profile', authenticate, validateCsrf, updateHealthProfile);
router.post('/health-profile/allergies', authenticate, validateCsrf, addAllergy);
router.delete('/health-profile/allergies/:allergy', authenticate, validateCsrf, removeAllergy);
router.post('/health-profile/conditions', authenticate, validateCsrf, addCondition);
router.delete('/health-profile/conditions/:condition', authenticate, validateCsrf, removeCondition);

// ─── Notification Preferences & Quiet Hours Routes ─────────────────────────────
router.get('/notifications', authenticate, getNotificationPreferences);
router.put('/notifications', authenticate, validateCsrf, updateNotificationPreferences);
router.patch('/notifications', authenticate, validateCsrf, updateNotificationPreferences);

export default router;
