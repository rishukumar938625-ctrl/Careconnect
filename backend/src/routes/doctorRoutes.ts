import { Router } from 'express';
import {
  getDoctors,
  getDoctorById,
  getDoctorAvailability,
} from '../controllers/doctorController.js';
import { searchLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public Doctor Directory Endpoints
router.get('/', searchLimiter, getDoctors);
router.get('/:id', searchLimiter, getDoctorById);
router.get('/:id/availability', searchLimiter, getDoctorAvailability);

export default router;
