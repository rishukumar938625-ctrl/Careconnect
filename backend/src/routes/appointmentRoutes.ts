import { Router } from 'express';
import {
  bookAppointment,
  getAppointments,
  getAppointmentHistory,
  getAppointmentById,
  rescheduleAppointment,
  cancelAppointment,
} from '../controllers/appointmentController.js';
import {
  getDoctors,
  getDoctorById,
  getDoctorAvailability,
} from '../controllers/doctorController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateCsrf } from '../middleware/csrfMiddleware.js';
import { mutationLimiter, searchLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Aliases for doctor directory under /api/appointments for backwards compatibility
router.get('/doctors', searchLimiter, getDoctors);
router.get('/doctors/:id', searchLimiter, getDoctorById);
router.get('/doctors/:id/availability', searchLimiter, getDoctorAvailability);

// Appointment History (must be defined before /:id)
router.get('/history', authenticate, getAppointmentHistory);

// User Appointments CRUD
router.get('/', authenticate, getAppointments);
router.post('/', authenticate, mutationLimiter, validateCsrf, bookAppointment);
router.get('/:id', authenticate, getAppointmentById);
router.patch('/:id/reschedule', authenticate, mutationLimiter, validateCsrf, rescheduleAppointment);
router.patch('/:id/cancel', authenticate, mutationLimiter, validateCsrf, cancelAppointment);

export default router;
