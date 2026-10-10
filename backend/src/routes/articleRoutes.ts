import { Router } from 'express';
import {
  getArticles,
  getArticleBySlug,
  toggleArticleBookmark,
} from '../controllers/articleController.js';
import { optionalAuth, authenticate } from '../middleware/authMiddleware.js';
import { validateCsrf } from '../middleware/csrfMiddleware.js';

const router = Router();

router.get('/', optionalAuth, getArticles);
router.get('/:slug', optionalAuth, getArticleBySlug);
router.post('/:slug/bookmark', authenticate, validateCsrf, toggleArticleBookmark);

export default router;
