import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  syncReminders,
} from '../controllers/notificationController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateCsrf } from '../middleware/csrfMiddleware.js';

const router = Router();

router.get('/', authenticate, getNotifications);
router.get('/unread-count', authenticate, getUnreadCount);
router.patch('/:id/read', authenticate, validateCsrf, markAsRead);
router.post('/mark-all-read', authenticate, validateCsrf, markAllAsRead);
router.post('/sync', authenticate, validateCsrf, syncReminders);

export default router;
