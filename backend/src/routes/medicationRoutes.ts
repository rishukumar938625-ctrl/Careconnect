import { Router } from 'express';
import {
  getMedications,
  createMedication,
  getMedicationById,
  updateMedication,
  deleteMedication,
} from '../controllers/medicationController.js';
import { getAdherenceStats } from '../controllers/doseController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateCsrf } from '../middleware/csrfMiddleware.js';
import { mutationLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// All medication routes require authentication
router.use(authenticate);

router.get('/stats/adherence', getAdherenceStats);
router.get('/', getMedications);
router.post('/', mutationLimiter, validateCsrf, createMedication);
router.get('/:id', getMedicationById);
router.patch('/:id', mutationLimiter, validateCsrf, updateMedication);
router.delete('/:id', mutationLimiter, validateCsrf, deleteMedication);

export default router;
