import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/items/meta - distinct types and sub_types for filter dropdowns
// NOTE: must be registered before /:id routes to avoid "meta" being parsed as an integer ID
router.get('/meta', async (req, res) => {
  try {
    const types = await prisma.item.findMany({ select: { type: true }, distinct: ['type'], orderBy: { type: 'asc' } });
    const subTypes = await prisma.item.findMany({ select: { type: true, sub_type: true }, distinct: ['type', 'sub_type'], orderBy: [{ type: 'asc' }, { sub_type: 'asc' }] });
    res.json({ types: types.map(t => t.type), subTypes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch item metadata' });
  }
});

// GET /api/items - all items with optional filters
// Query params: type, sub_type, tl_min, tl_max, law_min, law_max, cost_min, cost_max, active
router.get('/', async (req, res) => {
  try {
    const { type, sub_type, tl_min, tl_max, law_min, law_max, cost_min, cost_max, active } = req.query;

    const where: any = {};
    if (type) where.type = type;
    if (sub_type) where.sub_type = sub_type;
    if (tl_min || tl_max) where.tech_level = {
      ...(tl_min ? { gte: parseInt(tl_min as string) } : {}),
      ...(tl_max ? { lte: parseInt(tl_max as string) } : {}),
    };
    if (law_min || law_max) where.law_level = {
      ...(law_min ? { gte: parseInt(law_min as string) } : {}),
      ...(law_max ? { lte: parseInt(law_max as string) } : {}),
    };
    if (cost_min || cost_max) where.cost_cr = {
      ...(cost_min ? { gte: parseFloat(cost_min as string) } : {}),
      ...(cost_max ? { lte: parseFloat(cost_max as string) } : {}),
    };
    if (active === 'true') where.active_in_game = true;
    if (active === 'false') where.active_in_game = false;
    // if active is undefined or anything else, no filter applied

    const items = await prisma.item.findMany({ where, orderBy: [{ type: 'asc' }, { sub_type: 'asc' }, { name: 'asc' }] });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// PATCH /api/items/bulk-toggle - toggle active_in_game for all items matching type + optional sub_type
// NOTE: must be registered before /:id to avoid "bulk-toggle" being parsed as an integer ID
router.patch('/bulk-toggle', async (req, res) => {
  try {
    const { type, sub_type, active_in_game } = req.body;
    const where: any = { type };
    if (sub_type) where.sub_type = sub_type;
    const result = await prisma.item.updateMany({ where, data: { active_in_game } });
    res.json({ updated: result.count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to bulk toggle items' });
  }
});

// PATCH /api/items/:id/toggle - toggle active_in_game for a single item
router.patch('/:id/toggle', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const updated = await prisma.item.update({ where: { id }, data: { active_in_game: !item.active_in_game } });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle item' });
  }
});

// PATCH /api/items/:id - update item fields (GM only)
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, sub_type, tech_level, law_level, black_market_category, cost_cr, mass_kg,
            damage, protection, magazine_qty, slots, radiation_protection,
            traits, range, required_skill, reference, description } = req.body;

    const updated = await prisma.item.update({
      where: { id },
      data: { name, sub_type, tech_level, law_level, black_market_category, cost_cr, mass_kg,
              damage, protection, magazine_qty, slots, radiation_protection,
              traits, range, required_skill, reference, description },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update item' });
  }
});

export default router;
