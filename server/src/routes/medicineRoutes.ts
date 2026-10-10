import { Router } from 'express';
import {
  getMedicines,
  getMedicineBySlug,
  toggleMedicineBookmark,
} from '../controllers/medicineController.js';
import { optionalAuth, authenticate } from '../middleware/authMiddleware.js';
import { validateCsrf } from '../middleware/csrfMiddleware.js';

const router = Router();

router.get('/', optionalAuth, getMedicines);
router.get('/:slug', optionalAuth, getMedicineBySlug);
router.post('/:slug/bookmark', authenticate, validateCsrf, toggleMedicineBookmark);

export default router;
