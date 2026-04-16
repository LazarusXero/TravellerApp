import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { prisma } from '../engine/index.js';
import { createError } from '../middleware/index.js';
import { HTTP_STATUS } from '../constants/index.js';

const router = Router();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_COLOR_SCHEMES = [
  'Matrix Green',
  'Half-Life Orange',
  'Jedi Blue',
  'Sith Red',
  'Predator Violet',
  'Tron Yellow',
  'Terminator Chrome',
  'Mass Effect Blue',
] as const;

// Full Traveller skill list (105 skills)
const SKILL_LIST: string[] = [
  'Admin', 'Advocate', 'Animals (Handler)', 'Animals (Trainer)', 'Animals (Veterinary)',
  'Art (Holography)', 'Art (Instrument)', 'Art (Performer)', 'Art (Visual Media)', 'Art (Write)',
  'Astrogation', 'Athletics (Dexterity)', 'Athletics (Endurance)', 'Athletics (Strength)',
  'Broker', 'Carouse', 'Deception', 'Diplomat',
  'Drive (Hovercraft)', 'Drive (Mole)', 'Drive (Track)', 'Drive (Walker)', 'Drive (Wheel)',
  'Electronics (Comms)', 'Electronics (Computers)', 'Electronics (Remote Ops)', 'Electronics (Sensors)',
  'Engineer (J-Drive)', 'Engineer (Life Support)', 'Engineer (M-Drive)', 'Engineer (Power)',
  'Explosives',
  'Flyer (Airship)', 'Flyer (Grav)', 'Flyer (Ornithopter)', 'Flyer (Rotor)', 'Flyer (Wing)',
  'Gambler',
  'Gun Combat (Archaic)', 'Gun Combat (Energy)', 'Gun Combat (Slug)',
  'Gunner (Capital)', 'Gunner (Ortillery)', 'Gunner (Screen)', 'Gunner (Turret)',
  'Heavy Weapons (Artillery)', 'Heavy Weapons (Man Portable)', 'Heavy Weapons (Vehicle)',
  'Investigate', 'Jack-of-All-Trades',
  'Language (Anglic)', 'Language (Aslan)', 'Language (Droyne)', 'Language (Oynprith)',
  'Language (Trokh)', 'Language (Vilani)', 'Language (Zdetl)',
  'Leadership', 'Mechanic', 'Medic',
  'Melee (Blade)', 'Melee (Bludgeon)', 'Melee (Natural)', 'Melee (Unarmed)',
  'Navigation', 'Persuade',
  'Pilot (Capital Ships)', 'Pilot (Small Craft)', 'Pilot (Spacecraft)',
  'Profession (Belter)', 'Profession (Biologicals)', 'Profession (Civil Engineering)',
  'Profession (Construction)', 'Profession (Hydroponics)', 'Profession (Polymers)',
  'Recon',
  'Science (Archaeology)', 'Science (Astronomy)', 'Science (Biology)', 'Science (Chemistry)',
  'Science (Cosmology)', 'Science (Cybernetics)', 'Science (Economics)', 'Science (Genetics)',
  'Science (History)', 'Science (Linguistics)', 'Science (Philosophy)', 'Science (Physics)',
  'Science (Planetology)', 'Science (Psionicology)', 'Science (Psychology)',
  'Science (Robotics)', 'Science (Sophontology)', 'Science (Xenology)',
  'Seafarer (Ocean Ships)', 'Seafarer (Personal)', 'Seafarer (Sail)', 'Seafarer (Submarine)',
  'Stealth', 'Steward', 'Streetwise', 'Survival',
  'Tactics (Military)', 'Tactics (Naval)',
  'Vacc Suit',
];

// ---------------------------------------------------------------------------
// Multer – portrait uploads
// ---------------------------------------------------------------------------

const portraitStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve('uploads/portraits');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.params.id}${ext}`);
  },
});

const upload = multer({
  storage: portraitStorage,
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHARACTER_WITH_SKILLS = {
  character_skills: { orderBy: { skillName: 'asc' as const } },
} as const;

/** Fetch the current game day; returns 0 if no game row exists. */
async function getCurrentGameDay(): Promise<number> {
  const game = await prisma.game.findFirst({ orderBy: { id: 'asc' }, select: { day: true } });
  return game?.day ?? 0;
}

/** Write a CHARACTER_EDIT event log entry, silently swallowing any error. */
async function writeEditLog(
  characterId: number,
  characterName: string,
  playerId: number,
  playerName: string,
  changes: string,
): Promise<void> {
  try {
    const gameDay = await getCurrentGameDay();
    await prisma.eventLog.create({
      data: {
        game_day: gameDay,
        event_type: 'CHARACTER_EDIT',
        character_id: characterId,
        description: `${playerName} (player ${playerId}) edited ${characterName}: ${changes}`,
        is_public: false,
      },
    });
  } catch {
    // EventLog table may not exist or game_day unavailable – skip silently
  }
}

/** Format a single change fragment for the summary string. */
function fmt(label: string, oldVal: unknown, newVal: unknown): string {
  const o = oldVal === null || oldVal === undefined ? 'NA' : String(oldVal);
  const n = newVal === null || newVal === undefined ? 'NA' : String(newVal);
  return `${label}: ${o} → ${n}`;
}

// ---------------------------------------------------------------------------
// POST /api/characters
// ---------------------------------------------------------------------------

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      playerId,
      name,
      species,
      age,
      gender,
      homeworld,
      background,
      notes,
      colorScheme,
      str,
      dex,
      end,
      int: intStat,
      edu,
      soc,
      skills,
    } = req.body as {
      playerId: number;
      name: string;
      species?: string;
      age?: number;
      gender?: string;
      homeworld?: string;
      background?: string;
      notes?: string;
      colorScheme: string;
      str?: number;
      dex?: number;
      end?: number;
      int?: number;
      edu?: number;
      soc?: number;
      skills?: Array<{ skillName: string; level: number }>;
    };

    if (!playerId || isNaN(Number(playerId))) {
      return next(createError('playerId is required', HTTP_STATUS.BAD_REQUEST));
    }
    if (!name?.trim()) {
      return next(createError('name is required', HTTP_STATUS.BAD_REQUEST));
    }
    if (!VALID_COLOR_SCHEMES.includes(colorScheme as (typeof VALID_COLOR_SCHEMES)[number])) {
      return next(createError(
        `colorScheme must be one of: ${VALID_COLOR_SCHEMES.join(', ')}`,
        HTTP_STATUS.BAD_REQUEST,
      ));
    }

    const pid = Number(playerId);

    // Verify player exists
    const player = await prisma.player.findUnique({ where: { id: pid }, select: { id: true } });
    if (!player) return next(createError('Player not found', HTTP_STATUS.NOT_FOUND));

    // Color scheme must be unique per player
    const colorConflict = await prisma.character.findFirst({
      where: { player_id: pid, colorScheme },
      select: { id: true },
    });
    if (colorConflict) {
      return next(createError(
        `Color scheme "${colorScheme}" is already used by another character for this player`,
        HTTP_STATUS.CONFLICT,
      ));
    }

    // First character for this player → isActive = true
    const existingCount = await prisma.character.count({ where: { player_id: pid } });
    const isActive = existingCount === 0;

    // Step 1 — create the character and seed all 105 skills at null
    const character = await prisma.character.create({
      data: {
        player_id: pid,
        name: name.trim(),
        species: species ?? null,
        age: age !== undefined ? Number(age) : null,
        gender: gender ?? null,
        homeworld: homeworld ?? null,
        background: background ?? null,
        notes: notes ?? null,
        colorScheme,
        isActive,
        status: 'ACTIVE',
        str: str !== undefined ? Number(str) : null,
        dex: dex !== undefined ? Number(dex) : null,
        end: end !== undefined ? Number(end) : null,
        int: intStat !== undefined ? Number(intStat) : null,
        edu: edu !== undefined ? Number(edu) : null,
        soc: soc !== undefined ? Number(soc) : null,
        character_skills: {
          createMany: {
            data: SKILL_LIST.map((skillName) => ({ skillName, level: null })),
          },
        },
      },
    });

    // Step 2 — apply submitted skill levels by iterating over the skills array
    const validSkills = Array.isArray(skills)
      ? skills
          .filter((s) => typeof s.skillName === 'string' && s.skillName.trim() !== '')
          .map((s) => ({ skillName: s.skillName as string, level: Number(s.level) }))
          .filter((s) => !isNaN(s.level))
      : [];

    if (validSkills.length > 0) {
      await prisma.$transaction(
        validSkills.map((s) =>
          prisma.characterSkill.update({
            where: { characterId_skillName: { characterId: character.id, skillName: s.skillName } },
            data: { level: s.level },
          }),
        ),
      );
    }

    // Fetch the final character with all skills (levels now applied)
    const result = await prisma.character.findUnique({
      where: { id: character.id },
      include: CHARACTER_WITH_SKILLS,
    });

    res.status(HTTP_STATUS.CREATED).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/characters/player/:playerId
// ---------------------------------------------------------------------------

router.get('/player/:playerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playerId = parseInt(String(req.params.playerId), 10);
    if (isNaN(playerId)) return next(createError('Invalid player ID', HTTP_STATUS.BAD_REQUEST));

    const characters = await prisma.character.findMany({
      where: { player_id: playerId },
      include: CHARACTER_WITH_SKILLS,
      orderBy: { created_at: 'asc' },
    });

    res.json({ success: true, data: characters });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/characters/:id
// ---------------------------------------------------------------------------

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid character ID', HTTP_STATUS.BAD_REQUEST));

    const character = await prisma.character.findUnique({
      where: { id },
      include: CHARACTER_WITH_SKILLS,
    });

    if (!character) return next(createError('Character not found', HTTP_STATUS.NOT_FOUND));

    res.json({ success: true, data: character });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/characters/:id
// ---------------------------------------------------------------------------

const UPDATABLE_SCALAR_FIELDS = [
  'name', 'species', 'age', 'gender', 'homeworld', 'background', 'notes',
  'colorScheme', 'status',
  'str', 'dex', 'end', 'int', 'edu', 'soc',
  'credits', 'skill_points',
] as const;

type UpdatableField = (typeof UPDATABLE_SCALAR_FIELDS)[number];

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid character ID', HTTP_STATUS.BAD_REQUEST));

    const { skills: incomingSkills, ...fieldUpdates } = req.body as {
      skills?: { skillName: string; level: number | null }[];
      [key: string]: unknown;
    };

    // Validate colorScheme if provided
    if (
      fieldUpdates.colorScheme !== undefined &&
      !VALID_COLOR_SCHEMES.includes(fieldUpdates.colorScheme as (typeof VALID_COLOR_SCHEMES)[number])
    ) {
      return next(createError(
        `colorScheme must be one of: ${VALID_COLOR_SCHEMES.join(', ')}`,
        HTTP_STATUS.BAD_REQUEST,
      ));
    }

    // Load current character + skills + player name for logging
    const existing = await prisma.character.findUnique({
      where: { id },
      include: {
        character_skills: true,
        player: { select: { id: true, name: true } },
      },
    });
    if (!existing) return next(createError('Character not found', HTTP_STATUS.NOT_FOUND));

    // -- Build diff summary --------------------------------------------------
    const changeParts: string[] = [];

    // Scalar field diffs
    for (const field of UPDATABLE_SCALAR_FIELDS) {
      if (field in fieldUpdates) {
        const oldVal = (existing as Record<string, unknown>)[field];
        const newVal = fieldUpdates[field];
        if (String(oldVal) !== String(newVal ?? '')) {
          // Human-readable label for stat fields
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

    const changesSummary = changeParts.join(' | ') || '(no changes)';

    // -- Apply updates -------------------------------------------------------

    // Build character data update (only allowed scalar fields)
    const characterData: Record<string, unknown> = {};
    for (const field of UPDATABLE_SCALAR_FIELDS) {
      if (field in fieldUpdates) {
        characterData[field] = fieldUpdates[field as UpdatableField];
      }
    }

    // Run character update + skill upserts in a transaction
    await prisma.$transaction(async (tx) => {
      if (Object.keys(characterData).length > 0) {
        await tx.character.update({ where: { id }, data: characterData });
      }

      if (incomingSkills?.length) {
        console.log(`[PUT /${id}] upserting ${incomingSkills.length} skill(s):`, incomingSkills.map((s) => `${s.skillName}=${s.level}`).join(', '));
        for (const { skillName, level } of incomingSkills) {
          await tx.characterSkill.upsert({
            where: { characterId_skillName: { characterId: id, skillName } },
            update: { level: level ?? null },
            create: { characterId: id, skillName, level: level ?? null },
          });
        }
      }
    });

    // Fetch updated character for response
    const updated = await prisma.character.findUnique({
      where: { id },
      include: CHARACTER_WITH_SKILLS,
    });

    // Write event log (silent on failure)
    await writeEditLog(
      id,
      existing.name,
      existing.player.id,
      existing.player.name,
      changesSummary,
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/characters/:id/activate
// ---------------------------------------------------------------------------

router.put('/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid character ID', HTTP_STATUS.BAD_REQUEST));

    const character = await prisma.character.findUnique({
      where: { id },
      select: { id: true, player_id: true },
    });
    if (!character) return next(createError('Character not found', HTTP_STATUS.NOT_FOUND));

    await prisma.$transaction([
      // Deactivate all other characters for this player
      prisma.character.updateMany({
        where: { player_id: character.player_id, id: { not: id } },
        data: { isActive: false },
      }),
      // Activate this character
      prisma.character.update({
        where: { id },
        data: { isActive: true },
      }),
    ]);

    const updated = await prisma.character.findUnique({
      where: { id },
      include: CHARACTER_WITH_SKILLS,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/characters/:id/portrait
// ---------------------------------------------------------------------------

router.post(
  '/:id/portrait',
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('image')(req, res, (err) => {
      if (err) return next(createError(err.message, HTTP_STATUS.BAD_REQUEST));
      next();
    });
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) return next(createError('Invalid character ID', HTTP_STATUS.BAD_REQUEST));

      if (!req.file) return next(createError('No image file provided', HTTP_STATUS.BAD_REQUEST));

      const exists = await prisma.character.findUnique({ where: { id }, select: { id: true } });
      if (!exists) return next(createError('Character not found', HTTP_STATUS.NOT_FOUND));

      const portrait_url = `uploads/portraits/${req.file.filename}`;

      const updated = await prisma.character.update({
        where: { id },
        data: { portrait_url },
        select: { id: true, name: true, portrait_url: true },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
