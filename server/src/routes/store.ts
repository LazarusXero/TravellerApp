import { Router, Request, Response } from 'express';
import { prisma } from '../engine/index.js';
import { generateStore } from '../services/storeService.js';

const router = Router();

function effectivePrice(baseCost: number, multiplier: number): number {
  return Math.round(baseCost * multiplier);
}

function formatRecord(row: {
  id: number;
  item_id: number;
  base_roll: number;
  final_roll: number;
  quantity: number;
  price_multiplier: number;
  item: {
    name: string;
    type: string;
    sub_type: string;
    cost_cr: number;
    mass_kg: number | null;
    law_level: number;
    tech_level: number;
    black_market_category: number;
    damage: string | null;
    protection: string | null;
    magazine_qty: number | null;
    slots: number | null;
    radiation_protection: number | null;
    traits: string | null;
    range: string | null;
    required_skill: string | null;
    reference: string | null;
    description: string | null;
  };
}) {
  return {
    id: row.id,
    item_id: row.item_id,
    item_name: row.item.name,
    item_type: row.item.type,
    item_sub_type: row.item.sub_type,
    base_price: row.item.cost_cr,
    mass_kg: row.item.mass_kg,
    law_level: row.item.law_level,
    tech_level: row.item.tech_level,
    black_market_category: row.item.black_market_category,
    damage: row.item.damage,
    protection: row.item.protection,
    magazine_qty: row.item.magazine_qty,
    slots: row.item.slots,
    radiation_protection: row.item.radiation_protection,
    traits: row.item.traits,
    range: row.item.range,
    required_skill: row.item.required_skill,
    reference: row.item.reference,
    description: row.item.description,
    base_roll: row.base_roll,
    final_roll: row.final_roll,
    quantity: row.quantity,
    price_multiplier: row.price_multiplier,
    effective_price: effectivePrice(row.item.cost_cr, row.price_multiplier),
  };
}

const ITEM_SELECT = {
  name: true,
  type: true,
  sub_type: true,
  cost_cr: true,
  mass_kg: true,
  law_level: true,
  tech_level: true,
  black_market_category: true,
  damage: true,
  protection: true,
  magazine_qty: true,
  slots: true,
  radiation_protection: true,
  traits: true,
  range: true,
  required_skill: true,
  reference: true,
  description: true,
} as const;

// POST /api/store/generate — regenerate store for current game
router.post('/generate', async (_req: Request, res: Response) => {
  try {
    const game = await prisma.game.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
    if (!game) return res.status(404).json({ success: false, error: 'No game found' });

    const count = await generateStore(game.id);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Store generation failed' });
  }
});

// GET /api/store/gm — all store records (GM view)
router.get('/gm', async (_req: Request, res: Response) => {
  try {
    const game = await prisma.game.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
    if (!game) return res.json({ success: true, data: [] });

    const rows = await prisma.storeInventory.findMany({
      where: { game_id: game.id },
      include: { item: { select: ITEM_SELECT } },
      orderBy: [{ quantity: 'desc' }, { item: { name: 'asc' } }],
    });

    res.json({ success: true, data: rows.map(formatRecord) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load store' });
  }
});

// GET /api/store/player — available items only (player view)
router.get('/player', async (_req: Request, res: Response) => {
  try {
    const game = await prisma.game.findFirst({ orderBy: { id: 'asc' }, select: { id: true } });
    if (!game) return res.json({ success: true, data: [] });

    const rows = await prisma.storeInventory.findMany({
      where: { game_id: game.id, quantity: { gt: 0 } },
      include: { item: { select: ITEM_SELECT } },
      orderBy: { item: { name: 'asc' } },
    });

    res.json({ success: true, data: rows.map(formatRecord) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to load store' });
  }
});

// PATCH /api/store/:id — GM override quantity / price_multiplier
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

    const { quantity, price_multiplier } = req.body as {
      quantity?: number;
      price_multiplier?: number;
    };

    const data: Record<string, unknown> = {};
    if (quantity !== undefined) data.quantity = quantity;
    if (price_multiplier !== undefined) data.price_multiplier = price_multiplier;

    const updated = await prisma.storeInventory.update({
      where: { id },
      data,
      include: { item: { select: ITEM_SELECT } },
    });

    res.json({ success: true, data: formatRecord(updated) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update store record' });
  }
});

// POST /api/store/purchase — player buys item
router.post('/purchase', async (req: Request, res: Response) => {
  try {
    const { store_inventory_id, character_id, quantity } = req.body as {
      store_inventory_id: number;
      character_id: number;
      quantity: number;
    };

    if (!store_inventory_id || !character_id || !quantity || quantity < 1) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const storeRow = await prisma.storeInventory.findUnique({
      where: { id: store_inventory_id },
      include: { item: { select: { cost_cr: true } } },
    });

    if (!storeRow) {
      return res.status(404).json({ success: false, error: 'Store item not found' });
    }

    if (storeRow.quantity < quantity) {
      return res
        .status(400)
        .json({ success: false, error: 'Quantity no longer available' });
    }

    const unitPrice = effectivePrice(storeRow.item.cost_cr, storeRow.price_multiplier);
    const totalCost = unitPrice * quantity;

    const character = await prisma.character.findUnique({
      where: { id: character_id },
      select: { credits: true },
    });

    if (!character) {
      return res.status(404).json({ success: false, error: 'Character not found' });
    }

    if (character.credits < totalCost) {
      return res.status(400).json({ success: false, error: 'Insufficient funds' });
    }

    const [updatedChar, updatedStore] = await prisma.$transaction(async (tx) => {
      const char = await tx.character.update({
        where: { id: character_id },
        data: { credits: { decrement: totalCost } },
        select: { credits: true },
      });

      const store = await tx.storeInventory.update({
        where: { id: store_inventory_id },
        data: { quantity: { decrement: quantity } },
        select: { quantity: true },
      });

      const existing = await tx.inventoryItem.findFirst({
        where: { owner_id: character_id, owner_type: 'character', item_id: storeRow.item_id },
      });

      if (existing) {
        await tx.inventoryItem.update({
          where: { id: existing.id },
          data: { quantity: { increment: quantity } },
        });
      } else {
        await tx.inventoryItem.create({
          data: {
            owner_type: 'character',
            owner_id: character_id,
            item_id: storeRow.item_id,
            quantity,
            purchased_price: unitPrice,
          },
        });
      }

      return [char, store];
    });

    res.json({
      success: true,
      new_balance: updatedChar.credits,
      remaining_store_quantity: updatedStore.quantity,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Purchase failed' });
  }
});

export default router;
