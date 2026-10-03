import { Router } from 'express';
import {
  getMedicines,
  getMedicineBySlug,
  toggleMedicineBookmark,
} from '../controllers/medicineController.js';

const router = Router();

router.get('/', getMedicines);
router.get('/:slug', getMedicineBySlug);
router.post('/:slug/bookmark', toggleMedicineBookmark);

export default router;
