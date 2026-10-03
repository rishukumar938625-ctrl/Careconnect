import { Router } from 'express';
import {
  getArticles,
  getArticleBySlug,
  toggleArticleBookmark,
} from '../controllers/articleController.js';

const router = Router();

router.get('/', getArticles);
router.get('/:slug', getArticleBySlug);
router.post('/:slug/bookmark', toggleArticleBookmark);

export default router;
