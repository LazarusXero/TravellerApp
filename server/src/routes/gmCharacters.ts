import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../engine/index.js';
import { createError } from '../middleware/index.js';
import { HTTP_STATUS } from '../constants/index.js';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHARACTER_WITH_SKILLS = {
  character_skills: { orderBy: { skillName: 'asc' as const } },
} as const;

async function getCurrentGameDay(): Promise<number> {
  const game = await prisma.game.findFirst({ orderBy: { id: 'asc' }, select: { day: true } });
  return game?.day ?? 0;
}

function fmt(label: string, oldVal: unknown, newVal: unknown): string {
  const o = oldVal === null || oldVal === undefined ? 'NA' : String(oldVal);
  const n = newVal === null || newVal === undefined ? 'NA' : String(newVal);
  return `${label}: ${o} → ${n}`;
}

function fmtCredits(oldVal: unknown, newVal: unknown): string {
  const fmt = (v: unknown) =>
    v === null || v === undefined ? 'NA' : Number(v).toLocaleString();
  return `Credits: ${fmt(oldVal)} → ${fmt(newVal)}`;
}

// GM-editable scalar fields only (excludes name, species, gender, homeworld, age, colorScheme, portrait_url, status, player_id)
const GM_EDITABLE_SCALAR_FIELDS = [
  'str', 'dex', 'end', 'int', 'edu', 'soc',
  'credits', 'skill_points',
  'background', 'notes',
] as const;

type GmEditableField = (typeof GM_EDITABLE_SCALAR_FIELDS)[number];

// ---------------------------------------------------------------------------
// GET /api/gm/characters
// ---------------------------------------------------------------------------

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const players = await prisma.player.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        characters: {
          orderBy: { name: 'asc' },
          include: CHARACTER_WITH_SKILLS,
        },
      },
    });

    res.json({ success: true, data: players });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/gm/characters/:id
// ---------------------------------------------------------------------------

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid character ID', HTTP_STATUS.BAD_REQUEST));

    const { skills: incomingSkills, ...fieldUpdates } = req.body as {
      skills?: { skillName: string; level: number | null }[];
      [key: string]: unknown;
    };

    const existing = await prisma.character.findUnique({
      where: { id },
      include: {
        character_skills: true,
      },
    });
    if (!existing) return next(createError('Character not found', HTTP_STATUS.NOT_FOUND));

    // -- Build diff summary --------------------------------------------------
    const changeParts: string[] = [];

    for (const field of GM_EDITABLE_SCALAR_FIELDS) {
      if (field in fieldUpdates) {
        const oldVal = (existing as Record<string, unknown>)[field];
        const newVal = fieldUpdates[field];
        if (String(oldVal) !== String(newVal ?? '')) {
          if (field === 'credits') {
            changeParts.push(fmtCredits(oldVal, newVal));
          } else if (field === 'skill_points') {
            const o = oldVal === null || oldVal === undefined ? 'NA' : String(oldVal);
            const n = newVal === null || newVal === undefined ? 'NA' : String(newVal);
            changeParts.push(`Skill Points: ${o} → ${n}`);
          } else if (field === 'background') {
            changeParts.push('Background updated');
          } else if (field === 'notes') {
            changeParts.push('Notes updated');
          } else {
            const label = field === 'str' ? 'STR'
              : field === 'dex' ? 'DEX'
              : field === 'end' ? 'END'
              : field === 'int' ? 'INT'
              : field === 'edu' ? 'EDU'
              : field === 'soc' ? 'SOC'
              : field;
            changeParts.push(fmt(label, oldVal, newVal));
          }
        }
      }
    }

    // Skill diffs
    if (incomingSkills?.length) {
      const skillMap = new Map(existing.character_skills.map((s) => [s.skillName, s.level]));
      for (const { skillName, level } of incomingSkills) {
        const oldLevel = skillMap.has(skillName) ? skillMap.get(skillName) : undefined;
        if (oldLevel !== undefined && String(oldLevel ?? 'NA') !== String(level ?? 'NA')) {
          changeParts.push(fmt(skillName, oldLevel, level));
        }
      }
    }

    const changesSummary = changeParts.join(', ') || '(no changes)';

    // -- Apply updates -------------------------------------------------------
    const characterData: Record<string, unknown> = {};
    for (const field of GM_EDITABLE_SCALAR_FIELDS) {
      if (field in fieldUpdates) {
        characterData[field] = fieldUpdates[field as GmEditableField];
      }
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(characterData).length > 0) {
        await tx.character.update({ where: { id }, data: characterData });
      }

      if (incomingSkills?.length) {
        for (const { skillName, level } of incomingSkills) {
          await tx.characterSkill.upsert({
            where: { characterId_skillName: { characterId: id, skillName } },
            update: { level: level ?? null },
            create: { characterId: id, skillName, level: level ?? null },
          });
        }
      }
    });

    const updated = await prisma.character.findUnique({
      where: { id },
      include: CHARACTER_WITH_SKILLS,
    });

    // Write event log (silent on failure)
    try {
      const gameDay = await getCurrentGameDay();
      await prisma.eventLog.create({
        data: {
          game_day: gameDay,
          event_type: 'GM_CHARACTER_EDIT',
          character_id: id,
          description: `GM edited ${existing.name}: ${changesSummary}`,
          is_public: false,
        },
      });
    } catch {
      // EventLog table may not exist or game_day unavailable – skip silently
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
