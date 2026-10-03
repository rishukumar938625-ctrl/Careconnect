import { Router } from 'express';
import {
  getConditions,
  getConditionBySlug,
  toggleConditionBookmark,
} from '../controllers/conditionController.js';

const router = Router();

router.get('/', getConditions);
router.get('/:slug', getConditionBySlug);
router.post('/:slug/bookmark', toggleConditionBookmark);

export default router;
