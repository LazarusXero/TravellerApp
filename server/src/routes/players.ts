import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../engine/index.js';
import { createError } from '../middleware/index.js';
import { HTTP_STATUS } from '../constants/index.js';

const router = Router();

// GET /api/players — public list (no pin_hash ever exposed)
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const players = await prisma.player.findMany({
      select: { id: true, name: true, role: true, active_character_id: true, created_at: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: players });
  } catch (error) {
    next(error);
  }
});

// GET /api/players/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid player ID', HTTP_STATUS.BAD_REQUEST));

    const player = await prisma.player.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        role: true,
        active_character_id: true,
        created_at: true,
        active_character: {
          select: {
            id: true, name: true, portrait_url: true, description: true,
            str: true, dex: true, end: true, int: true, edu: true, soc: true,
            skills: true, credits: true, skill_points: true,
          },
        },
      },
    });

    if (!player) return next(createError('Player not found', HTTP_STATUS.NOT_FOUND));

    res.json({ success: true, data: player });
  } catch (error) {
    next(error);
  }
});

// POST /api/players — create player (GM action)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, pin, role } = req.body as { name: string; pin: string; role?: string };

    if (!name?.trim()) {
      return next(createError('name is required', HTTP_STATUS.BAD_REQUEST));
    }
    if (!pin || !/^\d{4}$/.test(String(pin))) {
      return next(createError('PIN must be exactly 4 digits', HTTP_STATUS.BAD_REQUEST));
    }

    const pin_hash = await bcrypt.hash(String(pin), 10);

    const player = await prisma.player.create({
      data: { name: name.trim(), pin_hash, role: role ?? 'player' },
      select: { id: true, name: true, role: true, active_character_id: true, created_at: true },
    });

    res.status(HTTP_STATUS.CREATED).json({ success: true, data: player });
  } catch (error) {
    next(error);
  }
});

// PUT /api/players/:id/pin — change PIN
router.put('/:id/pin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid player ID', HTTP_STATUS.BAD_REQUEST));

    const { pin } = req.body as { pin: string };
    if (!pin || !/^\d{4}$/.test(String(pin))) {
      return next(createError('PIN must be exactly 4 digits', HTTP_STATUS.BAD_REQUEST));
    }

    const pin_hash = await bcrypt.hash(String(pin), 10);
    await prisma.player.update({ where: { id }, data: { pin_hash } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/players/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid player ID', HTTP_STATUS.BAD_REQUEST));

    await prisma.player.delete({ where: { id } });
    res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
});

export default router;
