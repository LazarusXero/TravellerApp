import { prisma } from '../engine/index.js';

function roll2d6(): number {
  return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
}

function rollEffect(finalRoll: number): number {
  if (finalRoll < 8) return 0;
  const effect = finalRoll - 8;
  let total = 0;
  for (let i = 0; i <= effect; i++) {
    total += Math.floor(Math.random() * 6) + 1;
  }
  return total;
}

function getTlDm(itemTl: number, worldTl: number): number {
  const diff = Math.abs(itemTl - worldTl);
  if (diff >= 10) return -4;
  if (diff >= 5) return -2;
  if (diff >= 3) return -1;
  return 0;
}

function getPortDm(portType: string): number {
  if (portType === 'A' || portType === 'B') return 1;
  if (portType === 'X') return -4;
  return 0;
}

function getTradeCodeDm(tradeCodes: string | null): number {
  const codes = tradeCodes ? tradeCodes.split(' ') : [];
  let dm = 0;
  if (codes.some((c) => ['Hi', 'Ht', 'In', 'Ri'].includes(c))) dm += 2;
  if (codes.some((c) => ['Lt', 'Na', 'Ni', 'Po'].includes(c))) dm -= 2;
  return dm;
}

function getPopulationDm(pop: number): number {
  if (pop === 0) return -4;
  if (pop <= 2) return -2;
  if (pop <= 5) return -1;
  if (pop <= 8) return 0;
  if (pop <= 11) return 1;
  return 2;
}

function getLawDm(law: number): number {
  if (law === 0) return 2;
  if (law <= 3) return 1;
  if (law <= 6) return 0;
  if (law <= 9) return -1;
  return -2;
}

function getBmCategoryDm(cat: number): number {
  if (cat === 0) return 6;
  if (cat === 1) return 4;
  if (cat === 2) return 2;
  if (cat === 3) return 0;
  if (cat === 4) return -2;
  if (cat === 5) return -4;
  return -6;
}

async function getItemIdsByTypeAndSubType(itemType: string, itemSubType: string): Promise<number[]> {
  const items = await prisma.item.findMany({
    where: { type: itemType, sub_type: itemSubType },
    select: { id: true },
  });
  return items.map((i) => i.id);
}

export async function generateBMForWorld(worldId: number, gameDay: number): Promise<number> {
  const world = await prisma.world.findUnique({
    where: { id: worldId },
    select: {
      technology: true,
      law: true,
      population: true,
      port_type: true,
      trade_codes: true,
    },
  });

  if (!world) return 0;

  const worldTl = parseInt(world.technology, 16) || 0;
  const worldLaw = parseInt(world.law, 16) || 0;
  const worldPop = parseInt(world.population, 16) || 0;

  const portDm = getPortDm(world.port_type);
  const tradeCodeDm = getTradeCodeDm(world.trade_codes);
  const popDm = getPopulationDm(worldPop);
  const lawDm = getLawDm(worldLaw);

  const items = await prisma.item.findMany({
    where: {
      active_in_game: true,
      law_level: { lt: worldLaw },
    },
    select: {
      id: true,
      tech_level: true,
      black_market_category: true,
    },
  });

  for (const item of items) {
    const tlDm = getTlDm(item.tech_level, worldTl);
    const bmCatDm = getBmCategoryDm(item.black_market_category);
    const bmBaseRoll = roll2d6() + tlDm + portDm + tradeCodeDm + popDm + lawDm + bmCatDm;

    await prisma.bMInventory.upsert({
      where: { world_id_item_id: { world_id: worldId, item_id: item.id } },
      create: {
        world_id: worldId,
        item_id: item.id,
        visit_day: gameDay,
        bm_base_roll: bmBaseRoll,
        bm_final_roll: null,
        bm_quantity: null,
      },
      update: {
        visit_day: gameDay,
        bm_base_roll: bmBaseRoll,
        bm_final_roll: null,
        bm_quantity: null,
      },
    });
  }

  const unlocks = await prisma.blackMarketUnlock.findMany({
    where: { world_id: worldId, is_unlocked: true },
  });

  for (const unlock of unlocks) {
    const itemIds = await getItemIdsByTypeAndSubType(unlock.item_type, unlock.item_sub_type);
    if (itemIds.length === 0) continue;

    const bmRows = await prisma.bMInventory.findMany({
      where: { world_id: worldId, item_id: { in: itemIds } },
    });

    for (const row of bmRows) {
      const bmFinalRoll = row.bm_base_roll + unlock.streetwise_dm;
      await prisma.bMInventory.update({
        where: { id: row.id },
        data: { bm_final_roll: bmFinalRoll, bm_quantity: rollEffect(bmFinalRoll) },
      });
    }
  }

  return items.length;
}

export async function unlockBMSubType(
  worldId: number,
  itemType: string,
  itemSubType: string,
  streetwiseDM: number,
  unlockedBy: string | null,
  gameDay: number,
  gmOverride: boolean
): Promise<void> {
  await prisma.blackMarketUnlock.upsert({
    where: {
      world_id_item_type_item_sub_type: {
        world_id: worldId,
        item_type: itemType,
        item_sub_type: itemSubType,
      },
    },
    create: {
      world_id: worldId,
      item_type: itemType,
      item_sub_type: itemSubType,
      is_unlocked: true,
      streetwise_dm: streetwiseDM,
      unlocked_by: unlockedBy,
      unlocked_day: gameDay,
      gm_override: gmOverride,
    },
    update: {
      is_unlocked: true,
      streetwise_dm: streetwiseDM,
      unlocked_by: unlockedBy,
      unlocked_day: gameDay,
      gm_override: gmOverride,
    },
  });

  const itemIds = await getItemIdsByTypeAndSubType(itemType, itemSubType);
  if (itemIds.length === 0) return;

  const bmRows = await prisma.bMInventory.findMany({
    where: { world_id: worldId, item_id: { in: itemIds } },
  });

  for (const row of bmRows) {
    const bmFinalRoll = row.bm_base_roll + streetwiseDM;
    await prisma.bMInventory.update({
      where: { id: row.id },
      data: { bm_final_roll: bmFinalRoll, bm_quantity: rollEffect(bmFinalRoll) },
    });
  }
}

export async function lockBMSubType(
  worldId: number,
  itemType: string,
  itemSubType: string
): Promise<void> {
  await prisma.blackMarketUnlock.updateMany({
    where: { world_id: worldId, item_type: itemType, item_sub_type: itemSubType },
    data: { is_unlocked: false },
  });

  const itemIds = await getItemIdsByTypeAndSubType(itemType, itemSubType);
  if (itemIds.length === 0) return;

  await prisma.bMInventory.updateMany({
    where: { world_id: worldId, item_id: { in: itemIds } },
    data: { bm_final_roll: null, bm_quantity: null },
  });
}
