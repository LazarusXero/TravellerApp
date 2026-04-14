import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../engine/index.js';
import { createError } from '../middleware/index.js';
import { HTTP_STATUS } from '../constants/index.js';

const router = Router();

// POST /api/auth/login
// Body: { player_id: number, pin: string }
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { player_id, pin } = req.body as { player_id: number; pin: string };

    if (!player_id || !pin) {
      return next(createError('player_id and pin are required', HTTP_STATUS.BAD_REQUEST));
    }

    const player = await prisma.player.findUnique({ where: { id: Number(player_id) } });

    if (!player) {
      return next(createError('Player not found', HTTP_STATUS.NOT_FOUND));
    }

    const valid = await bcrypt.compare(String(pin), player.pin_hash);

    if (!valid) {
      return next(createError('Invalid PIN', HTTP_STATUS.UNAUTHORIZED));
    }

    res.json({
      success: true,
      data: {
        id: player.id,
        name: player.name,
        role: player.role,
        active_character_id: player.active_character_id,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
