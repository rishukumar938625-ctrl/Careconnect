import { Router } from 'express';
import {
  getDoctors,
  getDoctorById,
  getDoctorAvailability,
} from '../controllers/doctorController.js';

const router = Router();

// Public Doctor Directory Endpoints
router.get('/', getDoctors);
router.get('/:id', getDoctorById);
router.get('/:id/availability', getDoctorAvailability);

export default router;
