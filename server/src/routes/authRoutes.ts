import { Router } from 'express';
import { register, login, logout, me } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/me', authenticate, me);

export default router;
