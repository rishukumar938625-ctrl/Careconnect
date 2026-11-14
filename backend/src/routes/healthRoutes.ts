import { Router } from 'express';
import { getHealth, getDbHealth } from '../controllers/healthController.js';
import {
  getConditions,
  getConditionBySlug,
  toggleConditionBookmark,
} from '../controllers/conditionController.js';
import {
  getMedicines,
  getMedicineBySlug,
  toggleMedicineBookmark,
} from '../controllers/medicineController.js';
import {
  getArticles,
  getArticleBySlug,
  toggleArticleBookmark,
} from '../controllers/articleController.js';
import { optionalAuth, authenticate } from '../middleware/authMiddleware.js';
import { validateCsrf } from '../middleware/csrfMiddleware.js';

const router = Router();

// ─── Health Check Endpoints ───────────────────────────────────────────────────

// GET /api/health - Server health status
router.get('/', getHealth);

// GET /api/health/db - MongoDB connection status
router.get('/db', getDbHealth);

// ─── Health Content Forwarding (for /api/health/* compatibility) ──────────────

router.get('/conditions', optionalAuth, getConditions);
router.get('/conditions/:slug', optionalAuth, getConditionBySlug);
router.post('/conditions/:slug/bookmark', authenticate, validateCsrf, toggleConditionBookmark);

router.get('/medicines', optionalAuth, getMedicines);
router.get('/medicines/:slug', optionalAuth, getMedicineBySlug);
router.post('/medicines/:slug/bookmark', authenticate, validateCsrf, toggleMedicineBookmark);

router.get('/articles', optionalAuth, getArticles);
router.get('/articles/:slug', optionalAuth, getArticleBySlug);
router.post('/articles/:slug/bookmark', authenticate, validateCsrf, toggleArticleBookmark);

export default router;
