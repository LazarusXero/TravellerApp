import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../engine/index.js';
import { createError } from '../middleware/index.js';
import { HTTP_STATUS } from '../constants/index.js';
import { unlockBMSubType, lockBMSubType } from '../utils/blackMarket.js';

const router = Router();

function getStreetwiseDm(level: number | null | undefined, hasRecord: boolean): number {
  if (!hasRecord) return -1;
  if (level == null) return -1;
  if (level === 0) return 0;
  return level;
}

// GET /api/black-market/:worldId/inventory
router.get('/:worldId/inventory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const worldId = parseInt(String(req.params.worldId), 10);
    if (isNaN(worldId)) return next(createError('Invalid world ID', HTTP_STATUS.BAD_REQUEST));

    const [bmRows, unlocks] = await Promise.all([
      prisma.bMInventory.findMany({
        where: { world_id: worldId },
        include: { item: true },
        orderBy: { item_id: 'asc' },
      }),
      prisma.blackMarketUnlock.findMany({
        where: { world_id: worldId },
      }),
    ]);

    const unlockMap = new Map(
      unlocks.map((u) => [`${u.item_type}|${u.item_sub_type}`, u])
    );

    const data = bmRows.map((row) => {
      const unlock = unlockMap.get(`${row.item.type}|${row.item.sub_type}`);
      return {
        item: row.item,
        bm_base_roll: row.bm_base_roll,
        bm_final_roll: row.bm_final_roll,
        bm_quantity: row.bm_quantity,
        is_unlocked: unlock?.is_unlocked ?? false,
        streetwise_dm: unlock?.streetwise_dm ?? 0,
        unlocked_by: unlock?.unlocked_by ?? null,
        unlocked_day: unlock?.unlocked_day ?? null,
        gm_override: unlock?.gm_override ?? false,
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// POST /api/black-market/:worldId/unlock
router.post('/:worldId/unlock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const worldId = parseInt(String(req.params.worldId), 10);
    if (isNaN(worldId)) return next(createError('Invalid world ID', HTTP_STATUS.BAD_REQUEST));

    const {
      item_type,
      item_sub_type,
      character_id,
      gm_override,
      streetwise_dm: dmOverride,
    } = req.body as {
      item_type: string;
      item_sub_type: string;
      character_id?: number;
      gm_override?: boolean;
      streetwise_dm?: number;
    };

    if (!item_type || !item_sub_type) {
      return next(createError('item_type and item_sub_type are required', HTTP_STATUS.BAD_REQUEST));
    }

    const game = await prisma.game.findFirst({
      orderBy: { id: 'asc' },
      select: { day: true },
    });
    const gameDay = game?.day ?? 1;

    let streetwiseDm: number;
    let unlockedBy: string | null = null;

    if (gm_override && dmOverride !== undefined) {
      streetwiseDm = parseInt(String(dmOverride), 10);
      unlockedBy = 'GM';
    } else {
      if (!character_id) {
        return next(createError('character_id is required', HTTP_STATUS.BAD_REQUEST));
      }
      const skillRecord = await prisma.characterSkill.findUnique({
        where: { characterId_skillName: { characterId: character_id, skillName: 'Streetwise' } },
        select: { level: true },
      });
      streetwiseDm = getStreetwiseDm(skillRecord?.level, skillRecord !== null);
      const character = await prisma.character.findUnique({
        where: { id: character_id },
        select: { name: true },
      });
      unlockedBy = character?.name ?? null;
    }

    await unlockBMSubType(
      worldId,
      item_type,
      item_sub_type,
      streetwiseDm,
      unlockedBy,
      gameDay,
      gm_override ?? false
    );

    const itemIds = await prisma.item
      .findMany({ where: { type: item_type, sub_type: item_sub_type }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));

    const bmRows = await prisma.bMInventory.findMany({
      where: { world_id: worldId, item_id: { in: itemIds } },
      include: { item: true },
    });

    const unlock = await prisma.blackMarketUnlock.findUnique({
      where: {
        world_id_item_type_item_sub_type: {
          world_id: worldId,
          item_type: item_type,
          item_sub_type: item_sub_type,
        },
      },
    });

    const data = bmRows.map((row) => ({
      item: row.item,
      bm_base_roll: row.bm_base_roll,
      bm_final_roll: row.bm_final_roll,
      bm_quantity: row.bm_quantity,
      is_unlocked: unlock?.is_unlocked ?? true,
      streetwise_dm: unlock?.streetwise_dm ?? streetwiseDm,
      unlocked_by: unlock?.unlocked_by ?? null,
      unlocked_day: unlock?.unlocked_day ?? null,
      gm_override: unlock?.gm_override ?? false,
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// POST /api/black-market/:worldId/lock
router.post('/:worldId/lock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const worldId = parseInt(String(req.params.worldId), 10);
    if (isNaN(worldId)) return next(createError('Invalid world ID', HTTP_STATUS.BAD_REQUEST));

    const { item_type, item_sub_type } = req.body as {
      item_type: string;
      item_sub_type: string;
    };

    if (!item_type || !item_sub_type) {
      return next(createError('item_type and item_sub_type are required', HTTP_STATUS.BAD_REQUEST));
    }

    await lockBMSubType(worldId, item_type, item_sub_type);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/black-market/:worldId/purchase
router.post('/:worldId/purchase', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const worldId = parseInt(String(req.params.worldId), 10);
    if (isNaN(worldId)) return next(createError('Invalid world ID', HTTP_STATUS.BAD_REQUEST));

    const { item_id, character_id, quantity, unit_price } = req.body as {
      item_id: number;
      character_id: number;
      quantity: number;
      unit_price: number;
    };

    if (!item_id || !character_id || !quantity || quantity < 1 || unit_price == null) {
      return next(createError('Missing required fields', HTTP_STATUS.BAD_REQUEST));
    }

    const bmRow = await prisma.bMInventory.findUnique({
      where: { world_id_item_id: { world_id: worldId, item_id } },
    });

    if (!bmRow) return next(createError('Item not found in BM inventory', HTTP_STATUS.NOT_FOUND));

    const available = bmRow.bm_quantity ?? 0;
    if (available < quantity) {
      return next(createError('Quantity not available', HTTP_STATUS.BAD_REQUEST));
    }

    const character = await prisma.character.findUnique({
      where: { id: character_id },
      select: { credits: true },
    });
    if (!character) return next(createError('Character not found', HTTP_STATUS.NOT_FOUND));

    const totalCost = unit_price * quantity;
    if (character.credits < totalCost) {
      return next(createError('Insufficient funds', HTTP_STATUS.BAD_REQUEST));
    }

    const [updatedChar, updatedBM] = await prisma.$transaction(async (tx) => {
      const char = await tx.character.update({
        where: { id: character_id },
        data: { credits: { decrement: totalCost } },
        select: { credits: true },
      });

      const bm = await tx.bMInventory.update({
        where: { id: bmRow.id },
        data: { bm_quantity: { decrement: quantity } },
        select: { bm_quantity: true },
      });

      const existing = await tx.inventoryItem.findFirst({
        where: { owner_id: character_id, owner_type: 'character', item_id },
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
            item_id,
            quantity,
            purchased_price: unit_price,
          },
        });
      }

      return [char, bm];
    });

    res.json({
      success: true,
      new_balance: updatedChar.credits,
      remaining_bm_quantity: updatedBM.bm_quantity,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
