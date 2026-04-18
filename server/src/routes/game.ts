import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../engine/index.js';
import { createError } from '../middleware/index.js';
import { HTTP_STATUS } from '../constants/index.js';
import { generateStore } from '../services/storeService.js';

const router = Router();

const WORLD_SELECT = {
  id: true,
  name: true,
  hex_code: true,
  sector: true,
  subsector: true,
  port_type: true,
  port_attitude: true,
  allegiance: true,
} as const;

// GET /api/game — fetch the active game (first row, includes current world)
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const game = await prisma.game.findFirst({
      orderBy: { id: 'asc' },
      include: { current_world: { select: WORLD_SELECT } },
    });
    res.json({ success: true, data: game ?? null });
  } catch (error) {
    next(error);
  }
});

// POST /api/game — create a new game
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, milieu, is_drinax, day } = req.body as {
      name: string;
      milieu?: string;
      is_drinax?: boolean;
      day?: number;
    };

    if (!name?.trim()) {
      return next(createError('name is required', HTTP_STATUS.BAD_REQUEST));
    }

    const game = await prisma.game.create({
      data: {
        name: name.trim(),
        milieu: milieu?.trim() || null,
        is_drinax: is_drinax ?? true,
        day: day ?? 1,
      },
      include: { current_world: { select: WORLD_SELECT } },
    });

    res.status(HTTP_STATUS.CREATED).json({ success: true, data: game });
  } catch (error) {
    next(error);
  }
});

// POST /api/game/:id/advance-day — increment day by 1
router.post('/:id/advance-day', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid game ID', HTTP_STATUS.BAD_REQUEST));

    const game = await prisma.game.update({
      where: { id },
      data: { day: { increment: 1 } },
      include: { current_world: { select: WORLD_SELECT } },
    });

    await prisma.character.updateMany({
      data: { activity_points: 2 },
    });

    res.json({ success: true, data: game });
  } catch (error) {
    next(error);
  }
});

// POST /api/game/:id/toggle-jump — flip in_jump_space
router.post('/:id/toggle-jump', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid game ID', HTTP_STATUS.BAD_REQUEST));

    const current = await prisma.game.findUnique({ where: { id }, select: { in_jump_space: true } });
    if (!current) return next(createError('Game not found', HTTP_STATUS.NOT_FOUND));

    const game = await prisma.game.update({
      where: { id },
      data: { in_jump_space: !current.in_jump_space },
      include: { current_world: { select: WORLD_SELECT } },
    });

    res.json({ success: true, data: game });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/game/:id/set-world — set current world, exits jump space
router.patch('/:id/set-world', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid game ID', HTTP_STATUS.BAD_REQUEST));

    const { world_id } = req.body as { world_id: number };
    if (!world_id || typeof world_id !== 'number') {
      return next(createError('world_id is required', HTTP_STATUS.BAD_REQUEST));
    }

    const world = await prisma.world.findUnique({ where: { id: world_id }, select: { id: true } });
    if (!world) return next(createError('World not found', HTTP_STATUS.NOT_FOUND));

    const game = await prisma.game.update({
      where: { id },
      data: { current_world_id: world_id, in_jump_space: false },
      include: { current_world: { select: WORLD_SELECT } },
    });

    // Generate fresh store for the new world (fire-and-forget; don't block response)
    generateStore(game.id).catch((err) =>
      console.error('[store] Generation failed after set-world:', err)
    );

    res.json({ success: true, data: game });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/game/:id/set-jump — enter jump space, clears current world and store
router.patch('/:id/set-jump', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid game ID', HTTP_STATUS.BAD_REQUEST));

    const [game] = await prisma.$transaction([
      prisma.game.update({
        where: { id },
        data: { in_jump_space: true, current_world_id: null },
        include: { current_world: { select: WORLD_SELECT } },
      }),
      prisma.storeInventory.deleteMany({ where: { game_id: id } }),
    ]);

    res.json({ success: true, data: game });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/game/:id — remove a game (used when replacing with a new campaign)
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid game ID', HTTP_STATUS.BAD_REQUEST));

    await prisma.game.delete({ where: { id } });
    res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
});

export default router;
