import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../engine/index.js';
import { createError } from '../middleware/index.js';
import { HTTP_STATUS } from '../constants/index.js';

const router = Router();

// GET /api/worlds?visible_only=true
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const visibleOnly = req.query.visible_only === 'true';

    const worlds = await prisma.world.findMany({
      where: visibleOnly ? { is_hidden: false } : undefined,
      orderBy: [{ sector: 'asc' }, { subsector: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        hex_code: true,
        port_type: true,
        size: true,
        atmosphere: true,
        hydrographics: true,
        population: true,
        government: true,
        law: true,
        technology: true,
        trade_codes: true,
        allegiance: true,
        port_attitude: true,
        naval_base: true,
        key_system: true,
        secure_world: true,
        dangerous_world: true,
        is_hidden: true,
        is_aslan_port: true,
        total_donations_cr: true,
        sector: true,
        subsector: true,
        notes: true,
      },
    });

    res.json({ success: true, data: worlds });
  } catch (error) {
    next(error);
  }
});

// PUT /api/worlds/:id — update notes, is_hidden, port_attitude
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid world ID', HTTP_STATUS.BAD_REQUEST));

    const { notes, is_hidden, port_attitude } = req.body as {
      notes?: string | null;
      is_hidden?: boolean;
      port_attitude?: string | null;
    };

    const data: Record<string, unknown> = {};
    if (notes !== undefined) data.notes = notes;
    if (is_hidden !== undefined) data.is_hidden = is_hidden;
    if (port_attitude !== undefined) data.port_attitude = port_attitude;

    if (Object.keys(data).length === 0) {
      return next(createError('No updatable fields provided', HTTP_STATUS.BAD_REQUEST));
    }

    const world = await prisma.world.update({
      where: { id },
      data,
    });

    res.json({ success: true, data: world });
  } catch (error) {
    next(error);
  }
});

export default router;
