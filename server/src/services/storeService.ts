import { prisma } from '../engine/index.js';

function rollDice(n: number, sides: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += Math.floor(Math.random() * sides) + 1;
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

function getTradeDm(tradeCodes: string): number {
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

export async function generateStore(gameId: number): Promise<number> {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { current_world_id: true },
  });

  if (!game?.current_world_id) return 0;

  const world = await prisma.world.findUnique({
    where: { id: game.current_world_id },
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

  // Party skill DM — highest broker or streetwise across all characters
  const allSkills = await prisma.characterSkill.findMany({
    where: {
      skillName: { in: ['Broker', 'Streetwise'] },
      level: { not: null },
    },
    select: { level: true },
  });

  const partyDm =
    allSkills.length > 0
      ? Math.max(...allSkills.map((s) => s.level ?? 0))
      : -3;

  const portDm = getPortDm(world.port_type);
  const tradeDm = getTradeDm(world.trade_codes ?? '');
  const popDm = getPopulationDm(worldPop);

  // All items with law_level >= worldLaw and active_in_game = true
  const items = await prisma.item.findMany({
    where: {
      law_level: { gte: worldLaw },
      active_in_game: true,
    },
    select: {
      id: true,
      tech_level: true,
      cost_cr: true,
    },
  });

  // Delete existing store for this game
  await prisma.storeInventory.deleteMany({ where: { game_id: gameId } });

  if (items.length === 0) return 0;

  const records = items.map((item) => {
    const baseRoll = rollDice(2, 6);
    const tlDm = getTlDm(item.tech_level, worldTl);
    const finalRoll = baseRoll + tlDm + portDm + tradeDm + popDm + partyDm;

    let quantity = 0;
    let priceMultiplier = 1.0;

    if (finalRoll <= 5) {
      quantity = 0;
      priceMultiplier = 1.0;
    } else if (finalRoll === 6) {
      quantity = rollDice(1, 6);
      priceMultiplier = 3.0;
    } else if (finalRoll === 7) {
      quantity = rollDice(1, 6);
      priceMultiplier = 2.0;
    } else {
      const effect = Math.max(0, finalRoll - 8);
      quantity = rollDice(effect + 1, 6);
      priceMultiplier = 1.0;
    }

    return {
      game_id: gameId,
      item_id: item.id,
      base_roll: baseRoll,
      final_roll: finalRoll,
      quantity,
      price_multiplier: priceMultiplier,
    };
  });

  await prisma.storeInventory.createMany({ data: records });

  return records.length;
}
