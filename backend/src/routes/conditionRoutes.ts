import { Router } from 'express';
import {
  getConditions,
  getConditionBySlug,
  toggleConditionBookmark,
} from '../controllers/conditionController.js';
import { optionalAuth, authenticate } from '../middleware/authMiddleware.js';
import { validateCsrf } from '../middleware/csrfMiddleware.js';

const router = Router();

router.get('/', optionalAuth, getConditions);
router.get('/:slug', optionalAuth, getConditionBySlug);
router.post('/:slug/bookmark', authenticate, validateCsrf, toggleConditionBookmark);

export default router;
