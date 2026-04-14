import { Router } from 'express';
import healthRouter from './health.js';
import authRouter from './auth.js';
import playersRouter from './players.js';
import gameRouter from './game.js';
import adminRouter from './admin.js';
import worldsRouter from './worlds.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/players', playersRouter);
router.use('/game', gameRouter);
router.use('/admin', adminRouter);
router.use('/worlds', worldsRouter);

export default router;
