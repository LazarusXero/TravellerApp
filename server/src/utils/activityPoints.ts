import { prisma } from '../engine/index.js';

export async function deductActivityPoints(
  characterId: number,
  cost: number,
  _actionLabel: string,
): Promise<void> {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: { activity_points: true },
  });

  if (!character) throw new Error('Character not found');
  if (character.activity_points < cost) throw new Error('Insufficient activity points');

  await prisma.character.update({
    where: { id: characterId },
    data: { activity_points: { decrement: cost } },
  });

  // TODO: write EventLog record here
}
