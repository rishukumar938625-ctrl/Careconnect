import { Router } from 'express';
import {
  getTodayDoses,
  getDoseHistory,
  updateDoseStatus,
  getAdherenceStats,
} from '../controllers/doseController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateCsrf } from '../middleware/csrfMiddleware.js';

const router = Router();

// All dose endpoints require authentication
router.use(authenticate);

router.get('/today', getTodayDoses);
router.get('/history', getDoseHistory);
router.get('/adherence', getAdherenceStats);
router.patch('/:id/status', validateCsrf, updateDoseStatus);

export default router;
