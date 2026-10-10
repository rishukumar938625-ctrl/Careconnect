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

const router = Router();

// ─── Health Check Endpoints ───────────────────────────────────────────────────

// GET /api/health - Server health status
router.get('/', getHealth);

// GET /api/health/db - MongoDB connection status
router.get('/db', getDbHealth);

// ─── Health Content Forwarding (for /api/health/* compatibility) ──────────────

router.get('/conditions', getConditions);
router.get('/conditions/:slug', getConditionBySlug);
router.post('/conditions/:slug/bookmark', toggleConditionBookmark);

router.get('/medicines', getMedicines);
router.get('/medicines/:slug', getMedicineBySlug);
router.post('/medicines/:slug/bookmark', toggleMedicineBookmark);

router.get('/articles', getArticles);
router.get('/articles/:slug', getArticleBySlug);
router.post('/articles/:slug/bookmark', toggleArticleBookmark);

export default router;
