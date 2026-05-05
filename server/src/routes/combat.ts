import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../engine/index.js';
import { createError } from '../middleware/index.js';
import { HTTP_STATUS } from '../constants/index.js';

const router = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BAND_MAX_TP: Record<string, number> = {
  ADJACENT: 1,
  CLOSE: 2,
  SHORT: 4,
  MEDIUM: 9,
  LONG: 19,
  'VERY LONG': 44,
  DISTANT: 94,
};

function bandToThrustPoints(band: string): number {
  return BAND_MAX_TP[band] ?? 44;
}

function thrustPointsToBand(tp: number): string {
  if (tp < 1) return 'ADJACENT';
  if (tp < 2) return 'CLOSE';
  if (tp < 4) return 'SHORT';
  if (tp < 9) return 'MEDIUM';
  if (tp < 19) return 'LONG';
  if (tp < 44) return 'VERY LONG';
  return 'DISTANT';
}

const WEAPON_STATS: Record<
  string,
  { damage: string; range: string; traits: string | null; ammo_count: number; power_required: number }
> = {
  'Beam Laser':   { damage: '1D',       range: 'Medium',  traits: null,    ammo_count: 0,  power_required: 4  },
  'Pulse Laser':  { damage: '2D',       range: 'Long',    traits: null,    ammo_count: 0,  power_required: 4  },
  'Missile Rack': { damage: '4D',       range: 'Special', traits: 'Smart', ammo_count: 12, power_required: 0  },
  'Sandcaster':   { damage: 'Special',  range: 'Special', traits: null,    ammo_count: 20, power_required: 0  },
  'Ion Cannon':   { damage: '2D x 10',  range: 'Medium',  traits: 'Ion',   ammo_count: 0,  power_required: 10 },
};

const MOUNT_POINT_DEFENSE: Record<string, number> = {
  Fixed: 0,
  'Single Turret': 0,
  'Double Turret': 1,
  'Triple Turret': 2,
};

const SESSION_INCLUDE = {
  objects: {
    include: {
      weapon_mounts: { include: { weapons: true } },
      crew_members: true,
      system_hits: true,
      repair_progress: true,
      ranges_from: { include: { to_object: true } },
      ranges_to: { include: { from_object: true } },
    },
  },
  ranges: {
    include: {
      from_object: true,
      to_object: true,
    },
  },
  system_hits: true,
  boarding: true,
} as const;

const VALID_PHASES = ['SETUP', 'INITIATIVE', 'MANOEUVRE', 'ATTACK', 'ACTION', 'CLEANUP'] as const;

const VALID_ROLES = [
  'CAPTAIN', 'PILOT', 'GUNNER', 'ENGINEER', 'SENSOR OPERATOR', 'MARINE', 'PASSENGER',
] as const;

// ---------------------------------------------------------------------------
// SESSION MANAGEMENT
// ---------------------------------------------------------------------------

// POST /api/combat/session
router.post('/session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { game_id, name } = req.body as { game_id: number; name: string };
    if (!game_id || !name?.trim()) {
      return next(createError('game_id and name are required', HTTP_STATUS.BAD_REQUEST));
    }

    await prisma.combatSession.updateMany({
      where: { game_id, active: true },
      data: { active: false },
    });

    const session = await prisma.combatSession.create({
      data: {
        game_id,
        name: name.trim(),
        active: true,
        current_phase: 'SETUP',
        current_round: 1,
      },
    });

    res.status(HTTP_STATUS.CREATED).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

// GET /api/combat/session/active?game_id=...
router.get('/session/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const game_id = parseInt(String(req.query.game_id), 10);
    if (isNaN(game_id)) {
      return next(createError('game_id query param is required', HTTP_STATUS.BAD_REQUEST));
    }

    const session = await prisma.combatSession.findFirst({
      where: { game_id, active: true },
      include: SESSION_INCLUDE,
    });

    res.json({ success: true, data: session ?? null });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/combat/session/:id/end
router.delete('/session/:id/end', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid session ID', HTTP_STATUS.BAD_REQUEST));

    const session = await prisma.combatSession.update({
      where: { id },
      data: { active: false, ended_at: new Date() },
    });

    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/combat/session/:id/phase
router.patch('/session/:id/phase', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid session ID', HTTP_STATUS.BAD_REQUEST));

    const { phase } = req.body as { phase: string };
    if (!phase || !VALID_PHASES.includes(phase as (typeof VALID_PHASES)[number])) {
      return next(
        createError(`phase must be one of: ${VALID_PHASES.join('|')}`, HTTP_STATUS.BAD_REQUEST),
      );
    }

    // When advancing to MANOEUVRE, validate no duplicate confirmed roles or weapon mounts
    if (phase === 'MANOEUVRE') {
      const roles = await prisma.characterCombatRole.findMany({
        where: { session_id: id, confirmed: true },
        include: { character: { select: { id: true, name: true } } },
      });

      // GUNNER is exempt from role-level counting; mount-level counting catches its conflicts.
      const EXEMPT_ROLES = new Set(['MARINE', 'PASSENGER', 'GUNNER']);
      const roleCounts: Record<string, string[]> = {};
      const mountCounts: Record<number, string[]> = {};

      for (const r of roles) {
        if (!EXEMPT_ROLES.has(r.role)) {
          if (!roleCounts[r.role]) roleCounts[r.role] = [];
          roleCounts[r.role].push(r.character.name);
        }
        if (r.role === 'GUNNER' && r.mount_id != null) {
          if (!mountCounts[r.mount_id]) mountCounts[r.mount_id] = [];
          mountCounts[r.mount_id].push(r.character.name);
        }
      }

      const conflicts: string[] = [];
      for (const [role, names] of Object.entries(roleCounts)) {
        if (names.length > 1) conflicts.push(`${role}: ${names.join(', ')}`);
      }
      for (const names of Object.values(mountCounts)) {
        if (names.length > 1) conflicts.push(`Same weapon mount: ${names.join(', ')}`);
      }

      if (conflicts.length > 0) {
        return next(
          createError(
            `Duplicate role assignments must be resolved before advancing: ${conflicts.join('; ')}`,
            HTTP_STATUS.CONFLICT,
          ),
        );
      }
    }

    const session = await prisma.combatSession.update({
      where: { id },
      data: { current_phase: phase },
    });

    res.json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// ROLE ASSIGNMENT
// ---------------------------------------------------------------------------

// Roles that allow multiple players simultaneously at the role level.
// GUNNER is included here because it uses mount-level conflict checking instead —
// a second GUNNER is valid as long as they choose a different weapon mount.
const MULTI_PLAYER_ROLES = new Set(['MARINE', 'PASSENGER', 'GUNNER']);

// POST /api/combat/session/:sessionId/role
router.post('/session/:sessionId/role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = parseInt(String(req.params.sessionId), 10);
    if (isNaN(sessionId)) return next(createError('Invalid session ID', HTTP_STATUS.BAD_REQUEST));

    const { character_id, role, mount_id } = req.body as {
      character_id: number;
      role: string;
      mount_id?: number;
    };

    if (!character_id) {
      return next(createError('character_id is required', HTTP_STATUS.BAD_REQUEST));
    }
    if (!role || !VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      return next(
        createError(`role must be one of: ${VALID_ROLES.join('|')}`, HTTP_STATUS.BAD_REQUEST),
      );
    }
    if (role === 'GUNNER' && !mount_id) {
      return next(createError('mount_id is required when role is GUNNER', HTTP_STATUS.BAD_REQUEST));
    }

    const character = await prisma.character.findUnique({ where: { id: character_id } });
    if (!character) {
      return next(createError('Character not found', HTTP_STATUS.NOT_FOUND));
    }

    // Check for conflicts with other confirmed characters (exempt: MARINE, PASSENGER)
    if (!MULTI_PLAYER_ROLES.has(role)) {
      const conflict = await prisma.characterCombatRole.findFirst({
        where: {
          session_id: sessionId,
          role,
          confirmed: true,
          NOT: { character_id },
        },
        include: { character: { select: { name: true } } },
      });
      if (conflict) {
        return next(
          createError(
            `Role ${role} is already confirmed by ${conflict.character.name}`,
            HTTP_STATUS.CONFLICT,
          ),
        );
      }
    }

    // For GUNNER: check if the chosen mount is already claimed by another confirmed gunner
    if (role === 'GUNNER' && mount_id) {
      const mountConflict = await prisma.characterCombatRole.findFirst({
        where: {
          session_id: sessionId,
          role: 'GUNNER',
          mount_id,
          confirmed: true,
          NOT: { character_id },
        },
        include: { character: { select: { name: true } } },
      });
      if (mountConflict) {
        return next(
          createError(
            `Weapon mount is already assigned to ${mountConflict.character.name}`,
            HTTP_STATUS.CONFLICT,
          ),
        );
      }
    }

    const record = await prisma.characterCombatRole.upsert({
      where: { session_id_character_id: { session_id: sessionId, character_id } },
      update: { role, mount_id: mount_id ?? null, confirmed: false },
      create: { session_id: sessionId, character_id, role, mount_id: mount_id ?? null },
    });

    res.status(HTTP_STATUS.CREATED).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

// POST /api/combat/session/:sessionId/role/confirm
router.post('/session/:sessionId/role/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = parseInt(String(req.params.sessionId), 10);
    if (isNaN(sessionId)) return next(createError('Invalid session ID', HTTP_STATUS.BAD_REQUEST));

    const { character_id } = req.body as { character_id: number };
    if (!character_id) {
      return next(createError('character_id is required', HTTP_STATUS.BAD_REQUEST));
    }

    const existing = await prisma.characterCombatRole.findUnique({
      where: { session_id_character_id: { session_id: sessionId, character_id } },
    });
    if (!existing) {
      return next(createError('No role assignment found for this character', HTTP_STATUS.NOT_FOUND));
    }

    // Re-validate conflicts at confirm time (race condition guard)
    if (!MULTI_PLAYER_ROLES.has(existing.role)) {
      const conflict = await prisma.characterCombatRole.findFirst({
        where: {
          session_id: sessionId,
          role: existing.role,
          confirmed: true,
          NOT: { character_id },
        },
        include: { character: { select: { name: true } } },
      });
      if (conflict) {
        return next(
          createError(
            `Role ${existing.role} is already confirmed by ${conflict.character.name}`,
            HTTP_STATUS.CONFLICT,
          ),
        );
      }
    }

    if (existing.role === 'GUNNER' && existing.mount_id != null) {
      const mountConflict = await prisma.characterCombatRole.findFirst({
        where: {
          session_id: sessionId,
          role: 'GUNNER',
          mount_id: existing.mount_id,
          confirmed: true,
          NOT: { character_id },
        },
        include: { character: { select: { name: true } } },
      });
      if (mountConflict) {
        return next(
          createError(
            `Weapon mount is already assigned to ${mountConflict.character.name}`,
            HTTP_STATUS.CONFLICT,
          ),
        );
      }
    }

    const record = await prisma.characterCombatRole.update({
      where: { session_id_character_id: { session_id: sessionId, character_id } },
      data: { confirmed: true },
    });

    res.json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

// GET /api/combat/session/:sessionId/role/:characterId
router.get('/session/:sessionId/role/:characterId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = parseInt(String(req.params.sessionId), 10);
    const characterId = parseInt(String(req.params.characterId), 10);
    if (isNaN(sessionId) || isNaN(characterId)) {
      return next(createError('Invalid session ID or character ID', HTTP_STATUS.BAD_REQUEST));
    }

    const record = await prisma.characterCombatRole.findUnique({
      where: { session_id_character_id: { session_id: sessionId, character_id: characterId } },
    });

    res.json({ success: true, data: record ?? null });
  } catch (error) {
    next(error);
  }
});

// GET /api/combat/session/:sessionId/roles
router.get('/session/:sessionId/roles', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = parseInt(String(req.params.sessionId), 10);
    if (isNaN(sessionId)) return next(createError('Invalid session ID', HTTP_STATUS.BAD_REQUEST));

    const records = await prisma.characterCombatRole.findMany({
      where: { session_id: sessionId },
      include: { character: { select: { id: true, name: true } } },
    });

    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/combat/session/:sessionId/role/:characterId
router.delete('/session/:sessionId/role/:characterId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = parseInt(String(req.params.sessionId), 10);
    const characterId = parseInt(String(req.params.characterId), 10);
    if (isNaN(sessionId) || isNaN(characterId)) {
      return next(createError('Invalid session ID or character ID', HTTP_STATUS.BAD_REQUEST));
    }

    await prisma.characterCombatRole.delete({
      where: { session_id_character_id: { session_id: sessionId, character_id: characterId } },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// OBJECT MANAGEMENT
// ---------------------------------------------------------------------------

// POST /api/combat/session/:id/object
router.post('/session/:id/object', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = parseInt(String(req.params.id), 10);
    if (isNaN(sessionId)) return next(createError('Invalid session ID', HTTP_STATUS.BAD_REQUEST));

    const session = await prisma.combatSession.findUnique({
      where: { id: sessionId },
      select: { id: true, current_round: true, objects: { select: { id: true } } },
    });
    if (!session) return next(createError('Session not found', HTTP_STATUS.NOT_FOUND));

    const {
      object_type,
      name,
      ranges = [],
      ...rest
    } = req.body as Record<string, unknown> & {
      object_type: string;
      name: string;
      ranges?: Array<{ other_object_id: number; band: string }>;
    };

    if (!object_type || !name) {
      return next(createError('object_type and name are required', HTTP_STATUS.BAD_REQUEST));
    }

    const validTypes = ['SHIP', 'PLANET', 'STATION', 'MISSILE_SALVO'];
    if (!validTypes.includes(object_type)) {
      return next(
        createError(`object_type must be one of: ${validTypes.join('|')}`, HTTP_STATUS.BAD_REQUEST),
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const objectData: Record<string, any> = {
      session_id: sessionId,
      object_type,
      name: String(name).trim(),
      added_round: session.current_round,
    };

    if (object_type === 'SHIP') {
      const hull_max = Number(rest.hull_max);
      const computer_rating = Number(rest.computer_rating);
      const max_thrust = Number(rest.max_thrust);
      Object.assign(objectData, {
        ship_id: rest.ship_id != null ? Number(rest.ship_id) : null,
        is_player_ship: Boolean(rest.is_player_ship ?? false),
        tl: Number(rest.tl),
        size_tons: Number(rest.size_tons),
        max_thrust,
        adjusted_max_thrust: max_thrust,
        current_thrust: max_thrust,
        base_armor: Number(rest.base_armor),
        current_armor: Number(rest.current_armor),
        hull_max,
        hull_current: Number(rest.hull_current),
        sustained_damage_threshold: Math.ceil(hull_max / 10),
        fuel_capacity: Number(rest.fuel_capacity),
        fuel_current: Number(rest.fuel_current),
        fuel_tank_status: 'Intact',
        power_max: Number(rest.power_max),
        power_max_base: Number(rest.power_max),   // immutable baseline for repair restoration
        power_used: rest.power_used != null ? Number(rest.power_used) : 0,
        computer_rating,
        current_computer_rating: computer_rating,
        computer_status: 'Operational',
        life_support_status: 'Operational',
        j_drive_status: 'Operable',
        m_drive_status: 'Operable',
        sensor_range: 'Distant',
        sensor_status: 'Operable',
        cargo_status: 'Intact',
        marines: Number(rest.marines ?? 0),
        passengers: Number(rest.passengers ?? 0),
        ...(rest.cargo_weight != null && { cargo_weight: Number(rest.cargo_weight) }),
        ...(rest.cargo_value != null && { cargo_value: Number(rest.cargo_value) }),
        ...(rest.pilot_skill_dm != null && { pilot_skill_dm: Number(rest.pilot_skill_dm) }),
        ...(rest.leadership_skill_dm != null && { leadership_skill_dm: Number(rest.leadership_skill_dm) }),
        ...(rest.naval_tactics_dm != null && { naval_tactics_dm: Number(rest.naval_tactics_dm) }),
        ...(rest.captain_soc_dm != null && { captain_soc_dm: Number(rest.captain_soc_dm) }),
        ...(rest.gunner_skill_dm != null && { gunner_skill_dm: Number(rest.gunner_skill_dm) }),
        ...(rest.gunner_dex_dm != null && { gunner_dex_dm: Number(rest.gunner_dex_dm) }),
        ...(rest.engineer_skill_dm != null && { engineer_skill_dm: Number(rest.engineer_skill_dm) }),
        ...(rest.engineer_int_dm != null && { engineer_int_dm: Number(rest.engineer_int_dm) }),
        ...(rest.sensor_op_skill_dm != null && { sensor_op_skill_dm: Number(rest.sensor_op_skill_dm) }),
        ...(rest.sensor_op_int_dm != null && { sensor_op_int_dm: Number(rest.sensor_op_int_dm) }),
      });
    } else if (object_type === 'MISSILE_SALVO') {
      const target_object_id = Number(rest.target_object_id);
      Object.assign(objectData, {
        origin_object_id: Number(rest.origin_object_id),
        target_object_id,
        missile_quantity: Number(rest.missile_quantity),
        rounds_to_contact: Number(rest.rounds_to_contact),
        missile_thrust: 10,
        initiative: 99,
        move_intent: 'CLOSE',
        move_target_id: target_object_id,
      });
    } else if (object_type === 'PLANET') {
      const radius_km = Number(rest.radius_km);
      Object.assign(objectData, {
        radius_km,
        jump_distance_km: radius_km * 100,
      });
    }
    // STATION: no extra computed fields beyond name

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newObject = await prisma.combatObject.create({ data: objectData as any });

    // Create CombatRange records between new object and existing objects
    const existingIds = session.objects.map((o) => o.id);
    if (existingIds.length > 0 && Array.isArray(ranges) && ranges.length > 0) {
      const rangeRows = ranges
        .filter((r) => existingIds.includes(r.other_object_id))
        .map((r) => ({
          session_id: sessionId,
          from_object_id: Math.min(newObject.id, r.other_object_id),
          to_object_id: Math.max(newObject.id, r.other_object_id),
          thrust_points: bandToThrustPoints(r.band),
          band: r.band,
          last_updated_round: session.current_round,
        }));

      if (rangeRows.length > 0) {
        await prisma.combatRange.createMany({ data: rangeRows });
      }
    }

    const objectWithRanges = await prisma.combatObject.findUnique({
      where: { id: newObject.id },
      include: {
        weapon_mounts: { include: { weapons: true } },
        ranges_from: { include: { to_object: true } },
        ranges_to: { include: { from_object: true } },
      },
    });

    res.status(HTTP_STATUS.CREATED).json({ success: true, data: objectWithRanges });
  } catch (error) {
    next(error);
  }
});

// POST /api/combat/session/:sessionId/object/:objectId/weapons
router.post(
  '/session/:sessionId/object/:objectId/weapons',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const objectId = parseInt(String(req.params.objectId), 10);
      if (isNaN(objectId)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

      const { mounts } = req.body as {
        mounts: Array<{ mount_type: string; weapons: Array<{ weapon_type: string }> }>;
      };

      if (!Array.isArray(mounts) || mounts.length === 0) {
        return next(createError('mounts array is required', HTTP_STATUS.BAD_REQUEST));
      }

      for (const mount of mounts) {
        const createdMount = await prisma.combatWeaponMount.create({
          data: {
            object_id: objectId,
            mount_type: mount.mount_type,
            point_defense_dm: MOUNT_POINT_DEFENSE[mount.mount_type] ?? 0,
          },
        });

        if (Array.isArray(mount.weapons) && mount.weapons.length > 0) {
          await prisma.combatWeapon.createMany({
            data: mount.weapons.map((w) => {
              const stats = WEAPON_STATS[w.weapon_type] ?? {
                damage: 'Unknown',
                range: 'Unknown',
                traits: null,
                ammo_count: 0,
                power_required: 0,
              };
              return { mount_id: createdMount.id, weapon_type: w.weapon_type, ...stats };
            }),
          });
        }
      }

      const updatedObject = await prisma.combatObject.findUnique({
        where: { id: objectId },
        include: { weapon_mounts: { include: { weapons: true } } },
      });

      res.json({ success: true, data: updatedObject });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/combat/session/:sessionId/object/:objectId/crew
router.post(
  '/session/:sessionId/object/:objectId/crew',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const objectId = parseInt(String(req.params.objectId), 10);
      if (isNaN(objectId)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

      const { crew } = req.body as {
        crew: Array<{ name: string; role: string; hp_max: number }>;
      };

      if (!Array.isArray(crew) || crew.length === 0) {
        return next(createError('crew array is required', HTTP_STATUS.BAD_REQUEST));
      }

      await prisma.combatCrewMember.createMany({
        data: crew.map((c) => ({
          object_id: objectId,
          name: c.name,
          role: c.role,
          hp_max: c.hp_max,
          hp_current: c.hp_max,
          status: 'Active',
        })),
      });

      const created = await prisma.combatCrewMember.findMany({ where: { object_id: objectId } });
      res.status(HTTP_STATUS.CREATED).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/combat/session/:sessionId/object/:objectId
router.delete(
  '/session/:sessionId/object/:objectId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const objectId = parseInt(String(req.params.objectId), 10);
      if (isNaN(objectId)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

      await prisma.combatRange.deleteMany({
        where: { OR: [{ from_object_id: objectId }, { to_object_id: objectId }] },
      });

      await prisma.combatObject.delete({ where: { id: objectId } });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// RANGE MANAGEMENT
// ---------------------------------------------------------------------------

// PATCH /api/combat/range/:rangeId
router.patch('/range/:rangeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rangeId = parseInt(String(req.params.rangeId), 10);
    if (isNaN(rangeId)) return next(createError('Invalid range ID', HTTP_STATUS.BAD_REQUEST));

    const { band } = req.body as { band: string };
    if (!band || !(band in BAND_MAX_TP)) {
      return next(
        createError(
          `band must be one of: ${Object.keys(BAND_MAX_TP).join(' | ')}`,
          HTTP_STATUS.BAD_REQUEST,
        ),
      );
    }

    const range = await prisma.combatRange.update({
      where: { id: rangeId },
      data: { band, thrust_points: bandToThrustPoints(band) },
    });

    res.json({ success: true, data: range });
  } catch (error) {
    next(error);
  }
});

// POST /api/combat/session/:id/range
router.post('/session/:id/range', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = parseInt(String(req.params.id), 10);
    if (isNaN(sessionId)) return next(createError('Invalid session ID', HTTP_STATUS.BAD_REQUEST));

    const { from_object_id, to_object_id, band } = req.body as {
      from_object_id: number;
      to_object_id: number;
      band: string;
    };

    if (!from_object_id || !to_object_id || !band || !(band in BAND_MAX_TP)) {
      return next(
        createError('from_object_id, to_object_id, and valid band are required', HTTP_STATUS.BAD_REQUEST),
      );
    }

    const session = await prisma.combatSession.findUnique({
      where: { id: sessionId },
      select: { id: true, current_round: true },
    });
    if (!session) return next(createError('Session not found', HTTP_STATUS.NOT_FOUND));

    const fromId = Math.min(from_object_id, to_object_id);
    const toId = Math.max(from_object_id, to_object_id);

    const range = await prisma.combatRange.upsert({
      where: {
        session_id_from_object_id_to_object_id: {
          session_id: sessionId,
          from_object_id: fromId,
          to_object_id: toId,
        },
      },
      update: {
        band,
        thrust_points: bandToThrustPoints(band),
        last_updated_round: session.current_round,
      },
      create: {
        session_id: sessionId,
        from_object_id: fromId,
        to_object_id: toId,
        band,
        thrust_points: bandToThrustPoints(band),
        last_updated_round: session.current_round,
      },
    });

    res.status(HTTP_STATUS.CREATED).json({ success: true, data: range });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// CLEANUP
// ---------------------------------------------------------------------------

// PATCH /api/combat/session/:id/cleanup
router.patch('/session/:id/cleanup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = parseInt(String(req.params.id), 10);
    if (isNaN(sessionId)) return next(createError('Invalid session ID', HTTP_STATUS.BAD_REQUEST));

    const session = await prisma.combatSession.findUnique({
      where: { id: sessionId },
      include: { objects: true, ranges: true, boarding: true },
    });
    if (!session) return next(createError('Session not found', HTTP_STATUS.NOT_FOUND));

    const objectMap = new Map(session.objects.map((o) => [o.id, o]));

    // 1. RESOLVE MOVEMENT
    // CLOSE contributes negative delta (closing range), FLEE positive (opening range).
    // HOLD contributes 0 regardless of thrust_spent.
    const intentDelta = (intent: string | null, spent: number): number => {
      if (intent === 'CLOSE') return -spent;
      if (intent === 'FLEE') return +spent;
      return 0;
    };

    for (const range of session.ranges) {
      const fromObj = objectMap.get(range.from_object_id);
      const toObj = objectMap.get(range.to_object_id);
      if (!fromObj || !toObj) continue;

      const fromTargetsTo = fromObj.move_target_id === toObj.id;
      const toTargetsFrom = toObj.move_target_id === fromObj.id;

      let delta = 0;
      if (fromTargetsTo && toTargetsFrom) {
        delta =
          intentDelta(fromObj.move_intent, fromObj.thrust_spent) +
          intentDelta(toObj.move_intent, toObj.thrust_spent);
      } else if (fromTargetsTo) {
        delta = intentDelta(fromObj.move_intent, fromObj.thrust_spent);
      } else if (toTargetsFrom) {
        delta = intentDelta(toObj.move_intent, toObj.thrust_spent);
      }

      if (delta !== 0) {
        const newTp = Math.max(0, Math.min(94, range.thrust_points + delta));
        await prisma.combatRange.update({
          where: { id: range.id },
          data: {
            thrust_points: newTp,
            band: thrustPointsToBand(newTp),
            last_updated_round: session.current_round,
          },
        });
      }
    }

    // 2. RESET PER-ROUND OBJECT STATE
    // NOTE: leadership_effect is intentionally NOT reset here — it carries forward
    // into the next round's initiative calculation (set by Captain during Action phase).
    // MISSILE_SALVO objects keep their move_target_id (it's the ship they're tracking).
    await prisma.combatObject.updateMany({
      where: { session_id: sessionId, object_type: { not: 'MISSILE_SALVO' } },
      data: {
        initiative: null,
        move_intent: null,
        move_target_id: null,
        thrust_spent: 0,
        comms_jammed: false,
        ew_used: false,
      },
    });
    await prisma.combatObject.updateMany({
      where: { session_id: sessionId, object_type: 'MISSILE_SALVO' },
      data: {
        initiative: null,
        move_intent: null,
        // move_target_id preserved — missiles must retain their target across rounds
        thrust_spent: 0,
        comms_jammed: false,
        ew_used: false,
      },
    });

    // current_thrust resets to adjusted_max_thrust (varies per object — must loop)
    for (const obj of session.objects) {
      if (obj.adjusted_max_thrust != null) {
        await prisma.combatObject.update({
          where: { id: obj.id },
          data: { current_thrust: obj.adjusted_max_thrust },
        });
      }
    }

    // 3. RESET WEAPON STATUS
    const objectIds = session.objects.map((o) => o.id);
    await prisma.combatWeaponMount.updateMany({
      where: {
        object_id: { in: objectIds },
        ammo_status: { in: ['Fired', 'Reloading'] },
      },
      data: { ammo_status: 'Full' },
    });

    // 4. APPLY FUEL LEAKS
    for (const obj of session.objects) {
      if (obj.fuel_leak_rate > 0 && obj.fuel_tank_status === 'Intact' && obj.fuel_current != null) {
        await prisma.combatObject.update({
          where: { id: obj.id },
          data: { fuel_current: Math.max(0, obj.fuel_current - obj.fuel_leak_rate) },
        });
      }
    }

    // 5. DECREMENT LIFE SUPPORT TIMERS
    for (const obj of session.objects) {
      if (
        obj.life_support_status === 'Failing' &&
        obj.life_support_timer != null &&
        obj.life_support_timer > 0
      ) {
        const newTimer = obj.life_support_timer - 1;
        await prisma.combatObject.update({
          where: { id: obj.id },
          data: {
            life_support_timer: newTimer,
            ...(newTimer === 0 && { life_support_status: 'Failed' }),
          },
        });
      }
    }

    // 6. HANDLE BOARDING ACTION
    if (session.boarding) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const boardingUpdate: Record<string, any> = {};

      if (session.boarding.phase === 'RESOLUTION' && session.boarding.rounds_remaining != null) {
        boardingUpdate.rounds_remaining = session.boarding.rounds_remaining - 1;
      }
      if (
        session.boarding.phase === 'PACIFICATION' &&
        !session.boarding.pacification_paused &&
        session.boarding.pacification_timer != null &&
        session.boarding.pacification_timer > 0
      ) {
        boardingUpdate.pacification_timer = session.boarding.pacification_timer - 1;
      }

      if (Object.keys(boardingUpdate).length > 0) {
        await prisma.boardingAction.update({
          where: { id: session.boarding.id },
          data: boardingUpdate,
        });
      }
    }

    // 7. HANDLE OVERLOAD EFFECTS
    for (const obj of session.objects) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const overloadUpdate: Record<string, any> = {};

      if (obj.increase_thrust_next && obj.adjusted_max_thrust != null) {
        const newAdjMax = obj.adjusted_max_thrust + 1;
        overloadUpdate.adjusted_max_thrust = newAdjMax;
        overloadUpdate.current_thrust = newAdjMax;
        overloadUpdate.increase_thrust_next = false;
      }
      if (obj.increase_power_next && obj.power_max != null) {
        overloadUpdate.power_max = obj.power_max * 1.1;
        overloadUpdate.increase_power_next = false;
      }

      if (Object.keys(overloadUpdate).length > 0) {
        await prisma.combatObject.update({ where: { id: obj.id }, data: overloadUpdate });
      }
    }

    // 8. INCREMENT ROUND + ADVANCE PHASE TO INITIATIVE
    await prisma.combatSession.update({
      where: { id: sessionId },
      data: { current_round: { increment: 1 }, current_phase: 'INITIATIVE' },
    });

    // 9. MISSILE SALVO COUNTDOWN
    for (const obj of session.objects) {
      if (obj.object_type === 'MISSILE_SALVO' && (obj.rounds_to_contact ?? 0) > 0) {
        await prisma.combatObject.update({
          where: { id: obj.id },
          data: { rounds_to_contact: (obj.rounds_to_contact ?? 0) - 1 },
        });
      }
    }

    const updatedSession = await prisma.combatSession.findUnique({
      where: { id: sessionId },
      include: SESSION_INCLUDE,
    });

    res.json({ success: true, data: updatedSession });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// INITIATIVE
// ---------------------------------------------------------------------------

// POST /api/combat/object/:id/initiative
router.post('/object/:id/initiative', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

    const { initiative } = req.body as { initiative: number };
    if (initiative == null || typeof initiative !== 'number') {
      return next(createError('initiative is required', HTTP_STATUS.BAD_REQUEST));
    }

    const obj = await prisma.combatObject.update({
      where: { id },
      data: { initiative },
    });

    res.json({ success: true, data: obj });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// MOVEMENT
// ---------------------------------------------------------------------------

// POST /api/combat/object/:id/move
router.post('/object/:id/move', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

    const { move_intent, move_target_id, thrust_spent } = req.body as {
      move_intent: string;
      move_target_id: number;
      thrust_spent: number;
    };

    if (!['CLOSE', 'FLEE', 'HOLD'].includes(move_intent)) {
      return next(createError("move_intent must be 'CLOSE'|'FLEE'|'HOLD'", HTTP_STATUS.BAD_REQUEST));
    }

    const obj = await prisma.combatObject.findUnique({ where: { id } });
    if (!obj) return next(createError('Object not found', HTTP_STATUS.NOT_FOUND));

    // Restore any thrust spent on a prior declaration this phase (re-declaration resets it)
    const availableThrust = (obj.current_thrust ?? 0) + (obj.move_intent != null ? (obj.thrust_spent ?? 0) : 0);

    // HOLD doesn't require a target and spends no thrust
    if (move_intent === 'HOLD') {
      const updated = await prisma.combatObject.update({
        where: { id },
        data: { move_intent: 'HOLD', move_target_id: null, thrust_spent: 0, current_thrust: availableThrust },
      });
      return res.json({ success: true, data: updated });
    }

    if (thrust_spent > availableThrust) {
      return next(createError('thrust_spent exceeds available thrust', HTTP_STATUS.BAD_REQUEST));
    }

    // Validate target is in the same session
    const target = await prisma.combatObject.findFirst({
      where: { id: move_target_id, session_id: obj.session_id },
      select: { id: true },
    });
    if (!target) {
      return next(createError('move_target_id not found in session', HTTP_STATUS.BAD_REQUEST));
    }

    const updated = await prisma.combatObject.update({
      where: { id },
      data: {
        move_intent,
        move_target_id,
        thrust_spent,
        current_thrust: availableThrust - thrust_spent,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// ATTACK AND DAMAGE
// ---------------------------------------------------------------------------

// POST /api/combat/object/:id/damage
router.post('/object/:id/damage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

    const { damage, ignore_armor } = req.body as { damage: number; ignore_armor?: boolean };
    if (damage == null || typeof damage !== 'number') {
      return next(createError('damage is required', HTTP_STATUS.BAD_REQUEST));
    }

    const obj = await prisma.combatObject.findUnique({ where: { id } });
    if (!obj) return next(createError('Object not found', HTTP_STATUS.NOT_FOUND));

    const effective_damage = ignore_armor
      ? Math.max(0, damage)
      : Math.max(0, damage - (obj.current_armor ?? 0));
    const new_hull = Math.max(0, (obj.hull_current ?? 0) - effective_damage);
    const destroyed = new_hull <= 0;
    const sustained_damage_triggered =
      effective_damage > 0 &&
      obj.sustained_damage_threshold != null &&
      effective_damage >= obj.sustained_damage_threshold;

    const updated = await prisma.combatObject.update({
      where: { id },
      data: {
        hull_current: new_hull,
        ...(destroyed && { is_destroyed: true }),
      },
    });

    res.json({
      success: true,
      data: {
        object: updated,
        effective_damage,
        destroyed,
        sustained_damage_triggered,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// CRITICAL HIT
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CritObject = Record<string, any>;

/**
 * Recomputes all derived CombatObject fields by scanning the full set of active
 * (not yet repaired) system hits. This replaces direct per-hit writes for fields
 * shared between multiple systems (thrust, power, sensors, drives, computer,
 * life support) so that hits and repairs are always additive/subtractive rather
 * than last-write-wins.
 *
 * Physical losses (armor, cargo weight/value, fuel tank status, hull severity)
 * are NOT recalculated here — those are handled by direct writes in
 * applySystemEffects and are irreversible.
 */
async function recomputeDerivedFields(
  objectId: number,
  obj: CritObject,
): Promise<Record<string, unknown>> {
  // All active hits — beyond_repair hits still have their effects in play
  const activeHits = await prisma.combatSystemHit.findMany({
    where: { object_id: objectId, repaired: false },
  });

  const base_thrust   = obj.max_thrust       ?? 0;
  const base_power    = obj.power_max_base   ?? obj.power_max ?? 0;
  const base_computer = obj.computer_rating  ?? 0;

  // Accumulators — start from "no damage" baseline
  let thrust_sentinel   = false;   // any hit triggers disabled-drive sentinel
  let thrust_mod        = 0;
  let power_multiplier  = 1.0;
  let sensor_dm         = 0;
  let sensor_range: string | null  = null;
  let sensor_disabled   = false;
  let mdrive_check_dm   = 0;
  let mdrive_status: string | null = null;
  let jdrive_check_dm   = 0;
  let jdrive_status: string | null = null;
  let computer_reduction = 0;
  let computer_status: string | null = null;
  let life_degraded     = false;
  let life_failed       = false;

  const SENSOR_RANGES = ['Distant', 'Medium', 'Short', 'Close', 'Adjacent'];

  for (const hit of activeHits) {
    const s = Math.max(1, Math.min(6, hit.severity));

    switch (hit.system_name) {

      case 'Power Plant': {
        const ppThrustMods  = [-1, -2, -3, -999, -999, -999];
        const ppPowerMults  = [0.9, 0.8, 0.3, 0, 0, 0];
        const ppMod = ppThrustMods[s - 1];
        if (ppMod <= -999) { thrust_sentinel = true; }
        else               { thrust_mod += ppMod;    }
        power_multiplier *= ppPowerMults[s - 1];
        if (s >= 4) life_degraded = true;
        break;
      }

      case 'M-Drive': {
        const mdCheckDms   = [-1, -2, -3, -4, 0, 0];
        const mdThrustMods = [0, -1, -1, -1, -999, -999];
        mdrive_check_dm += mdCheckDms[s - 1];
        const mdMod = mdThrustMods[s - 1];
        if (mdMod <= -999) { thrust_sentinel = true; }
        else               { thrust_mod += mdMod;    }
        if (s >= 6) {
          mdrive_status = 'Destroyed';
        } else {
          mdrive_status = mdrive_status === 'Destroyed' ? 'Destroyed' : 'Operable - Damaged';
        }
        break;
      }

      case 'Sensors': {
        if (s <= 5) {
          sensor_dm += -2;
          const candidate = SENSOR_RANGES[s - 1];
          if (!sensor_range) {
            sensor_range = candidate;
          } else {
            // Most restrictive (highest index = shortest range)
            if (SENSOR_RANGES.indexOf(candidate) > SENSOR_RANGES.indexOf(sensor_range)) {
              sensor_range = candidate;
            }
          }
        } else {
          sensor_disabled = true;
        }
        break;
      }

      case 'J-Drive': {
        const jdCheckDms = [-2, 0, 0, 0, 0, 0];
        jdrive_check_dm += jdCheckDms[s - 1];
        if (s === 1) {
          jdrive_status = jdrive_status ?? 'Operable';
        } else if (s === 2) {
          jdrive_status = 'Disabled';
        } else if (s <= 5) {
          jdrive_status = jdrive_status === 'Destroyed' ? 'Destroyed' : 'Damaged';
        } else {
          jdrive_status = 'Destroyed';
        }
        break;
      }

      case 'Computer': {
        if (s <= 4) {
          computer_reduction += 1;
        } else if (s === 5) {
          computer_status = computer_status === 'Destroyed' ? 'Destroyed' : 'Disabled';
        } else {
          computer_status = 'Destroyed';
        }
        break;
      }

      case 'Crew': {
        if (s === 2 || s === 4) life_degraded = true;
        if (s >= 6)             life_failed   = true;
        break;
      }

      // Fuel, Armor, Cargo, Hull, Weapon: direct-write physical fields, not recalculated
    }
  }

  const update: Record<string, unknown> = {};

  // Thrust — sentinel wins over any numeric mod
  if (thrust_sentinel) {
    update.m_drive_thrust_mod  = -999;
    update.adjusted_max_thrust = 0;
  } else {
    update.m_drive_thrust_mod  = thrust_mod;
    update.adjusted_max_thrust = Math.max(0, base_thrust + thrust_mod);
  }

  // Power
  update.power_max = Math.max(0, base_power * power_multiplier);

  // Sensors
  update.sensor_check_dm = sensor_dm;
  update.sensor_range    = sensor_range;
  update.sensor_status   = sensor_disabled ? 'Disabled' : null;

  // M-Drive
  update.m_drive_check_dm = mdrive_check_dm;
  update.m_drive_status   = mdrive_status;

  // J-Drive
  update.j_drive_check_dm = jdrive_check_dm;
  update.j_drive_status   = jdrive_status;

  // Computer
  update.current_computer_rating = Math.max(0, base_computer - computer_reduction);
  update.computer_status = computer_status ?? (activeHits.some((h) => h.system_name === 'Computer') ? null : 'Operational');

  // Life support — worst state across all contributors
  if (life_failed) {
    update.life_support_status = 'Failed';
  } else if (life_degraded) {
    update.life_support_status = 'Failing';
  } else {
    update.life_support_status = 'Operational';
    update.life_support_timer  = null;
  }

  return update;
}

type SystemEffectResult = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  objectUpdate: Record<string, any>;
  roll_required: string | null;
  hull_severity_increase: number | null;
  mount_status_to_apply: string | null;
};

function applySystemEffects(
  system_name: string,
  finalSeverity: number,
  obj: CritObject,
): SystemEffectResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u: Record<string, any> = {};
  let roll_required: string | null = null;
  let hull_severity_increase: number | null = null;
  let mount_status_to_apply: string | null = null;

  const s = Math.max(1, Math.min(6, finalSeverity));

  // NOTE: Fields shared between multiple systems (m_drive_thrust_mod, adjusted_max_thrust,
  // power_max, sensor_*, m_drive_check_dm, m_drive_status, j_drive_*, computer_*,
  // life_support_status) are NOT written here. They are recomputed from the full
  // active-hits set by recomputeDerivedFields after every hit or repair.
  // Only irreversible physical writes remain below.
  switch (system_name) {
    case 'Sensors':
      // No direct physical writes — all effects handled by recomputeDerivedFields
      break;

    case 'Power Plant': {
      if (s === 5) hull_severity_increase = 1;
      if (s === 6) roll_required = 'HULL_1D';
      break;
    }

    case 'Fuel': {
      if (s === 1) {
        roll_required = 'FUEL_LEAK_1D_OVER_10';
      } else if (s === 2) {
        roll_required = 'FUEL_LEAK_1D';
      } else if (s === 3) {
        roll_required = 'FUEL_LEAK_1D_PCT';
      } else {
        u.fuel_tank_status = 'Destroyed';
        u.fuel_leak_rate = 0;
        if (s === 5) hull_severity_increase = 1;
        if (s === 6) roll_required = 'HULL_1D';
      }
      break;
    }

    case 'Weapon': {
      roll_required = 'RANDOM_WEAPON_MOUNT';
      if (s === 1) mount_status_to_apply = 'Bane';
      else if (s === 2) mount_status_to_apply = 'Disabled';
      else mount_status_to_apply = 'Destroyed';
      if (s >= 4) hull_severity_increase = 1;
      break;
    }

    case 'Armor': {
      if (s === 1) {
        u.current_armor = Math.max(0, (obj.current_armor ?? 0) - 1);
      } else if (s === 2) {
        roll_required = 'ARMOR_D3';
      } else if (s <= 4) {
        roll_required = 'ARMOR_1D';
      } else {
        roll_required = 'ARMOR_2D';
        hull_severity_increase = 1;
      }
      break;
    }

    case 'Hull': {
      roll_required = `HULL_${s}D`;
      break;
    }

    case 'M-Drive': {
      if (s >= 6) hull_severity_increase = 1;
      break;
    }

    case 'Cargo': {
      if (s === 1) {
        u.cargo_weight = Math.max(0, (obj.cargo_weight ?? 0) * 0.9);
        u.cargo_value  = Math.max(0, (obj.cargo_value  ?? 0) * 0.9);
      } else if (s === 2) {
        roll_required = 'CARGO_1D_PCT';
      } else if (s === 3) {
        roll_required = 'CARGO_2D_PCT';
      } else {
        u.cargo_weight = 0;
        u.cargo_value  = 0;
        u.cargo_status = 'Destroyed';
        if (s >= 5) hull_severity_increase = 1;
      }
      break;
    }

    case 'J-Drive': {
      if (s >= 4) hull_severity_increase = 1;
      break;
    }

    case 'Crew': {
      if (s === 1) {
        roll_required = 'CREW_1D_SINGLE';
      } else if (s === 2) {
        roll_required = 'LIFE_SUPPORT_1D_HOURS';
      } else if (s === 3) {
        roll_required = 'CREW_1D_ALL';
      } else if (s === 4) {
        roll_required = 'LIFE_SUPPORT_1D_ROUNDS';
      } else if (s === 5) {
        roll_required = 'CREW_3D_ALL';
      }
      // sev 6: beyond_repair handled at system_hit level; life_support recomputed
      break;
    }

    case 'Computer':
      // No direct physical writes — all effects handled by recomputeDerivedFields
      break;
  }

  // Apply deterministic hull_severity increases (non-roll-required ones)
  if (hull_severity_increase != null && roll_required !== 'HULL_1D') {
    u.hull_severity = (obj.hull_severity ?? 0) + hull_severity_increase;
  }

  return { objectUpdate: u, roll_required, hull_severity_increase, mount_status_to_apply };
}

// POST /api/combat/object/:id/critical-hit
router.post('/object/:id/critical-hit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

    const { system_name, severity, session_id } = req.body as {
      system_name: string;
      severity: number;
      session_id: number;
    };

    if (!system_name || severity == null) {
      return next(createError('system_name and severity are required', HTTP_STATUS.BAD_REQUEST));
    }

    const obj = await prisma.combatObject.findUnique({ where: { id } });
    if (!obj) return next(createError('Object not found', HTTP_STATUS.NOT_FOUND));

    // Upsert CombatSystemHit — stack severities, clamp at 6
    const existing = await prisma.combatSystemHit.findUnique({
      where: { session_id_object_id_system_name: { session_id, object_id: id, system_name } },
    });

    let finalSeverity: number;
    let beyondRepair: boolean;

    if (!existing) {
      finalSeverity = Math.min(6, severity);
      beyondRepair = finalSeverity >= 6;
      // Special override for Computer sev 6 and Crew sev 6
      if (system_name === 'Computer' && finalSeverity === 6) beyondRepair = true;
      if (system_name === 'Crew' && finalSeverity === 6) beyondRepair = true;
    } else {
      // Stack new damage on top of the historical peak (max_severity), even if the
      // system was previously repaired — per spec "added to previous maximum severity"
      finalSeverity = Math.min(6, (existing.max_severity ?? existing.severity) + severity);
      beyondRepair =
        finalSeverity >= 6 ||
        existing.beyond_repair ||
        (system_name === 'Computer' && finalSeverity >= 6) ||
        (system_name === 'Crew' && finalSeverity >= 6);
    }

    const system_hit = await prisma.combatSystemHit.upsert({
      where: { session_id_object_id_system_name: { session_id, object_id: id, system_name } },
      create: {
        session_id,
        object_id: id,
        system_name,
        severity: finalSeverity,
        max_severity: finalSeverity,
        beyond_repair: beyondRepair,
        recorded_round: 1,
      },
      update: {
        severity: finalSeverity,
        max_severity: Math.max(existing?.max_severity ?? 0, finalSeverity),
        beyond_repair: beyondRepair,
        repaired: false,   // re-hitting a repaired system makes it damaged again
      },
    });

    // 1. Apply irreversible physical writes (armor, cargo, fuel, hull_severity)
    const { objectUpdate, roll_required, hull_severity_increase, mount_status_to_apply } =
      applySystemEffects(system_name, finalSeverity, obj);

    if (Object.keys(objectUpdate).length > 0) {
      await prisma.combatObject.update({ where: { id }, data: objectUpdate });
    }

    // 2. Recompute all derived fields from the full set of active hits
    //    (re-fetch so recompute sees the latest physical-write values)
    const freshObj = await prisma.combatObject.findUnique({ where: { id } });
    const recomputedFields = await recomputeDerivedFields(id, freshObj as CritObject);
    const updated = await prisma.combatObject.update({ where: { id }, data: recomputedFields });

    res.json({
      success: true,
      data: {
        object: updated,
        system_hit,
        roll_required,
        hull_severity_increase,
        mount_status_to_apply,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// FOLLOW-UP ROLL RESOLUTION
// ---------------------------------------------------------------------------

// PATCH /api/combat/object/:id/fuel-leak
router.patch('/object/:id/fuel-leak', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

    const { leak_rate } = req.body as { leak_rate: number };
    if (leak_rate == null) return next(createError('leak_rate is required', HTTP_STATUS.BAD_REQUEST));

    const obj = await prisma.combatObject.update({
      where: { id },
      data: { fuel_leak_rate: Number(leak_rate) },
    });

    res.json({ success: true, data: obj });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/combat/object/:id/armor-damage
router.patch('/object/:id/armor-damage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

    const { reduction } = req.body as { reduction: number };
    if (reduction == null) return next(createError('reduction is required', HTTP_STATUS.BAD_REQUEST));

    const obj = await prisma.combatObject.findUnique({ where: { id } });
    if (!obj) return next(createError('Object not found', HTTP_STATUS.NOT_FOUND));

    const updated = await prisma.combatObject.update({
      where: { id },
      data: { current_armor: Math.max(0, (obj.current_armor ?? 0) - Number(reduction)) },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/combat/mount/:mountId/ammo-status
router.patch('/mount/:mountId/ammo-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mountId = parseInt(String(req.params.mountId), 10);
    if (isNaN(mountId)) return next(createError('Invalid mount ID', HTTP_STATUS.BAD_REQUEST));

    const { ammo_status } = req.body as { ammo_status: string };
    if (!['Full', 'Fired', 'Reloading', 'Empty'].includes(ammo_status)) {
      return next(
        createError("ammo_status must be 'Full'|'Fired'|'Reloading'|'Empty'", HTTP_STATUS.BAD_REQUEST),
      );
    }

    const mount = await prisma.combatWeaponMount.update({
      where: { id: mountId },
      data: { ammo_status },
      include: { weapons: true },
    });

    res.json({ success: true, data: mount });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/combat/mount/:mountId/status
router.patch('/mount/:mountId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mountId = parseInt(String(req.params.mountId), 10);
    if (isNaN(mountId)) return next(createError('Invalid mount ID', HTTP_STATUS.BAD_REQUEST));

    const { mount_status } = req.body as { mount_status: string };
    if (!['Bane', 'Disabled', 'Destroyed'].includes(mount_status)) {
      return next(
        createError("mount_status must be 'Bane'|'Disabled'|'Destroyed'", HTTP_STATUS.BAD_REQUEST),
      );
    }

    const mount = await prisma.combatWeaponMount.update({
      where: { id: mountId },
      data: { mount_status },
      include: { weapons: true },
    });

    res.json({ success: true, data: mount });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/combat/object/:id/hull-severity
router.patch('/object/:id/hull-severity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

    const { increase } = req.body as { increase: number };
    if (increase == null) return next(createError('increase is required', HTTP_STATUS.BAD_REQUEST));

    const obj = await prisma.combatObject.findUnique({ where: { id } });
    if (!obj) return next(createError('Object not found', HTTP_STATUS.NOT_FOUND));

    const updated = await prisma.combatObject.update({
      where: { id },
      data: { hull_severity: (obj.hull_severity ?? 0) + Number(increase) },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/combat/object/:id/crew-damage
router.patch('/object/:id/crew-damage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

    const { damage, target, crew_member_id } = req.body as {
      damage: number;
      target: 'SINGLE' | 'ALL';
      crew_member_id?: number;
    };

    if (!['SINGLE', 'ALL'].includes(target)) {
      return next(createError("target must be 'SINGLE'|'ALL'", HTTP_STATUS.BAD_REQUEST));
    }

    const crewToUpdate =
      target === 'SINGLE' && crew_member_id != null
        ? await prisma.combatCrewMember.findMany({
            where: { id: crew_member_id, object_id: id },
          })
        : await prisma.combatCrewMember.findMany({
            where: { object_id: id, status: { not: 'Dead' } },
          });

    const crewStatus = (hp_current: number, hp_max: number): string => {
      if (hp_current > hp_max / 2) return 'Active';
      if (hp_current > 0) return 'Wounded';
      return 'Incapacitated';
    };

    const updated = await Promise.all(
      crewToUpdate.map((c) => {
        const newHp = Math.max(0, c.hp_current - damage);
        return prisma.combatCrewMember.update({
          where: { id: c.id },
          data: { hp_current: newHp, status: crewStatus(newHp, c.hp_max) },
        });
      }),
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/combat/object/:id/life-support-timer
router.patch(
  '/object/:id/life-support-timer',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (isNaN(id)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

      const { timer, unit } = req.body as { timer: number; unit: 'HOURS' | 'ROUNDS' };
      if (timer == null || !['HOURS', 'ROUNDS'].includes(unit)) {
        return next(createError("timer and unit ('HOURS'|'ROUNDS') are required", HTTP_STATUS.BAD_REQUEST));
      }

      const rounds = unit === 'HOURS' ? Number(timer) * 10 : Number(timer);
      const obj = await prisma.combatObject.update({
        where: { id },
        data: { life_support_timer: rounds },
      });

      res.json({ success: true, data: obj });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// SENSOR ACTIONS
// ---------------------------------------------------------------------------

// PATCH /api/combat/object/:id/sensor-lock
router.patch('/object/:id/sensor-lock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actingId = parseInt(String(req.params.id), 10);
    if (isNaN(actingId)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

    const { target_object_id, locked } = req.body as {
      target_object_id: number;
      locked: boolean;
    };

    if (target_object_id == null || locked == null) {
      return next(createError('target_object_id and locked are required', HTTP_STATUS.BAD_REQUEST));
    }

    // Mark the acting ship as having used its EW action
    await prisma.combatObject.update({
      where: { id: actingId },
      data: { ew_used: true },
    });

    const target = await prisma.combatObject.update({
      where: { id: target_object_id },
      data: {
        sensor_lock_status: locked ? 'SENSOR LOCKED' : 'NO SENSOR LOCK',
      },
    });

    res.json({ success: true, data: target });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/combat/object/:id/leadership-effect
router.patch('/object/:id/leadership-effect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

    const { effect } = req.body as { effect: number };
    if (effect == null) return next(createError('effect is required', HTTP_STATUS.BAD_REQUEST));

    const updated = await prisma.combatObject.update({
      where: { id },
      data: { leadership_effect: effect },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/combat/object/:id/overload-drive
router.patch('/object/:id/overload-drive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

    const { success } = req.body as { success: boolean };
    if (success == null) return next(createError('success is required', HTTP_STATUS.BAD_REQUEST));

    const obj = await prisma.combatObject.findUnique({ where: { id } });
    if (!obj) return next(createError('Object not found', HTTP_STATUS.NOT_FOUND));

    const updated = await prisma.combatObject.update({
      where: { id },
      data: {
        ...(success ? { increase_thrust_next: true } : {}),
        overload_drive_dm: (obj.overload_drive_dm ?? 0) - 2,
      },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/combat/object/:id/overload-power
router.patch('/object/:id/overload-power', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

    const { success } = req.body as { success: boolean };
    if (success == null) return next(createError('success is required', HTTP_STATUS.BAD_REQUEST));

    const obj = await prisma.combatObject.findUnique({ where: { id } });
    if (!obj) return next(createError('Object not found', HTTP_STATUS.NOT_FOUND));

    const updated = await prisma.combatObject.update({
      where: { id },
      data: {
        ...(success ? { increase_power_next: true } : {}),
        overload_power_dm: (obj.overload_power_dm ?? 0) - 2,
      },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/combat/object/:id/thrust-deduct
router.patch('/object/:id/thrust-deduct', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

    const { amount } = req.body as { amount: number };
    if (amount == null || amount < 0) {
      return next(createError('amount is required and must be >= 0', HTTP_STATUS.BAD_REQUEST));
    }

    const obj = await prisma.combatObject.findUnique({ where: { id } });
    if (!obj) return next(createError('Object not found', HTTP_STATUS.NOT_FOUND));

    const updated = await prisma.combatObject.update({
      where: { id },
      data: { current_thrust: Math.max(0, (obj.current_thrust ?? 0) - amount) },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/combat/object/:id/jam-comms
router.patch('/object/:id/jam-comms', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

    const { target_object_id } = req.body as { target_object_id: number };
    if (target_object_id == null) {
      return next(createError('target_object_id is required', HTTP_STATUS.BAD_REQUEST));
    }

    await prisma.combatObject.update({ where: { id }, data: { ew_used: true } });

    const target = await prisma.combatObject.update({
      where: { id: target_object_id },
      data: { comms_jammed: true },
    });

    res.json({ success: true, data: target });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// REPAIR
// ---------------------------------------------------------------------------

// POST /api/combat/object/:id/repair
router.post('/object/:id/repair', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return next(createError('Invalid object ID', HTTP_STATUS.BAD_REQUEST));

    const { character_id, system_name, effect } = req.body as {
      character_id: number;
      system_name: string;
      effect: number;
    };

    if (character_id == null || !system_name || effect == null) {
      return next(createError('character_id, system_name, and effect are required', HTTP_STATUS.BAD_REQUEST));
    }

    // Find or create RepairProgress — reset bonus if engineer switched systems
    const existing = await prisma.repairProgress.findUnique({
      where: { object_id_character_id: { object_id: id, character_id } },
    });

    const systemChanged = existing != null && existing.system_name !== system_name;
    const progress = await prisma.repairProgress.upsert({
      where: { object_id_character_id: { object_id: id, character_id } },
      create: { object_id: id, character_id, system_name, consecutive_bonus: 0 },
      update: {
        system_name,
        consecutive_bonus: systemChanged ? 0 : existing?.consecutive_bonus ?? 0,
      },
    });

    if (effect >= 0) {
      // Successful repair — mark all hits on this system as repaired
      const system_hit = await prisma.combatSystemHit.updateMany({
        where: { object_id: id, system_name },
        data: { repaired: true },
      });

      await prisma.repairProgress.update({
        where: { id: progress.id },
        data: { consecutive_bonus: 0 },
      });

      // Recompute all derived fields — the repaired system's contribution is now absent
      // from activeHits (repaired: true excludes it from the query in recomputeDerivedFields)
      const obj = await prisma.combatObject.findUnique({ where: { id } });
      const recomputedFields = await recomputeDerivedFields(id, obj as CritObject);
      const updatedObj = await prisma.combatObject.update({ where: { id }, data: recomputedFields });

      res.json({ success: true, data: { repaired: true, object: updatedObj, system_hit } });
    } else {
      // Failed — accumulate consecutive bonus for next attempt
      const updated = await prisma.repairProgress.update({
        where: { id: progress.id },
        data: { consecutive_bonus: (progress.consecutive_bonus ?? 0) + 1 },
      });

      res.json({
        success: true,
        data: { repaired: false, consecutive_bonus: updated.consecutive_bonus },
      });
    }
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// BOARDING
// ---------------------------------------------------------------------------

// POST /api/combat/session/:id/boarding/start
router.post(
  '/session/:id/boarding/start',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = parseInt(String(req.params.id), 10);
      if (isNaN(sessionId)) return next(createError('Invalid session ID', HTTP_STATUS.BAD_REQUEST));

      const { attacker_object_id, defender_object_id } = req.body as {
        attacker_object_id: number;
        defender_object_id: number;
      };

      if (!attacker_object_id || !defender_object_id) {
        return next(createError('attacker_object_id and defender_object_id are required', HTTP_STATUS.BAD_REQUEST));
      }

      // Validate ADJACENT range exists between the two objects
      const aId = Math.min(attacker_object_id, defender_object_id);
      const bId = Math.max(attacker_object_id, defender_object_id);
      const range = await prisma.combatRange.findFirst({
        where: {
          session_id: sessionId,
          OR: [
            { from_object_id: aId, to_object_id: bId },
            { from_object_id: bId, to_object_id: aId },
          ],
        },
      });

      if (!range || range.band !== 'ADJACENT') {
        return next(createError('Objects must be at ADJACENT range to board', HTTP_STATUS.BAD_REQUEST));
      }

      // Ensure no existing boarding action on this session
      const existing = await prisma.boardingAction.findUnique({ where: { session_id: sessionId } });
      if (existing) {
        return next(createError('A boarding action is already active for this session', HTTP_STATUS.CONFLICT));
      }

      const boarding = await prisma.boardingAction.create({
        data: {
          session_id: sessionId,
          attacker_object_id,
          defender_object_id,
          phase: 'RESOLUTION',
          carry_forward_dm: 0,
          pacification_paused: false,
        },
      });

      res.status(HTTP_STATUS.CREATED).json({ success: true, data: boarding });
    } catch (error) {
      next(error);
    }
  },
);

// POST /api/combat/session/:id/boarding/resolve
router.post(
  '/session/:id/boarding/resolve',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = parseInt(String(req.params.id), 10);
      if (isNaN(sessionId)) return next(createError('Invalid session ID', HTTP_STATUS.BAD_REQUEST));

      const { boarding_result } = req.body as { boarding_result: number };
      if (boarding_result == null) {
        return next(createError('boarding_result is required', HTTP_STATUS.BAD_REQUEST));
      }

      const boarding = await prisma.boardingAction.findUnique({ where: { session_id: sessionId } });
      if (!boarding) return next(createError('No active boarding action', HTTP_STATUS.NOT_FOUND));

      if (boarding_result <= -7) {
        await prisma.boardingAction.delete({ where: { session_id: sessionId } });
        return res.json({
          success: true,
          data: { outcome: 'ATTACKER_DEFEATED', message: 'Boarding party defeated and driven off.' },
        });
      }

      if (boarding_result >= -6 && boarding_result <= -4) {
        await prisma.boardingAction.delete({ where: { session_id: sessionId } });
        return res.json({
          success: true,
          data: { outcome: 'BOARDING_DEFEATED', message: 'Boarding action repelled.' },
        });
      }

      if (boarding_result >= -3 && boarding_result <= -1) {
        await prisma.boardingAction.update({
          where: { session_id: sessionId },
          data: { carry_forward_dm: -2 },
        });
        return res.json({
          success: true,
          data: {
            outcome: 'CONTINUES',
            carry_forward_dm: -2,
            roll_required: 'ROUNDS_1D',
            hull_damage_required: '2D',
          },
        });
      }

      if (boarding_result === 0) {
        await prisma.boardingAction.update({
          where: { session_id: sessionId },
          data: { carry_forward_dm: 0 },
        });
        return res.json({
          success: true,
          data: { outcome: 'CONTINUES', carry_forward_dm: 0, roll_required: 'ROUNDS_1D' },
        });
      }

      if (boarding_result >= 1 && boarding_result <= 3) {
        await prisma.boardingAction.update({
          where: { session_id: sessionId },
          data: { carry_forward_dm: 2 },
        });
        return res.json({
          success: true,
          data: {
            outcome: 'CONTINUES',
            carry_forward_dm: 2,
            roll_required: 'ROUNDS_1D',
            hull_damage_required: '2D',
          },
        });
      }

      if (boarding_result >= 4 && boarding_result <= 6) {
        await prisma.boardingAction.update({
          where: { session_id: sessionId },
          data: { phase: 'PACIFICATION' },
        });
        return res.json({
          success: true,
          data: {
            outcome: 'PACIFICATION_START',
            roll_required: 'PACIFICATION_2D',
            hull_damage_required: '1D',
          },
        });
      }

      // boarding_result >= 7
      await prisma.boardingAction.delete({ where: { session_id: sessionId } });
      return res.json({
        success: true,
        data: { outcome: 'OVERWHELMING_SUCCESS', message: 'Ship taken in a single assault.' },
      });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/combat/session/:id/boarding/timer
router.patch(
  '/session/:id/boarding/timer',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = parseInt(String(req.params.id), 10);
      if (isNaN(sessionId)) return next(createError('Invalid session ID', HTTP_STATUS.BAD_REQUEST));

      const { rounds_remaining, pacification_timer } = req.body as {
        rounds_remaining?: number;
        pacification_timer?: number;
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = {};
      if (rounds_remaining != null) data.rounds_remaining = Number(rounds_remaining);
      if (pacification_timer != null) data.pacification_timer = Number(pacification_timer);

      if (Object.keys(data).length === 0) {
        return next(createError('rounds_remaining or pacification_timer is required', HTTP_STATUS.BAD_REQUEST));
      }

      const boarding = await prisma.boardingAction.update({
        where: { session_id: sessionId },
        data,
      });

      res.json({ success: true, data: boarding });
    } catch (error) {
      next(error);
    }
  },
);

// PATCH /api/combat/session/:id/boarding/range-check
router.patch(
  '/session/:id/boarding/range-check',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = parseInt(String(req.params.id), 10);
      if (isNaN(sessionId)) return next(createError('Invalid session ID', HTTP_STATUS.BAD_REQUEST));

      const { attacker_object_id, defender_object_id } = req.body as {
        attacker_object_id: number;
        defender_object_id: number;
      };

      const boarding = await prisma.boardingAction.findUnique({ where: { session_id: sessionId } });
      if (!boarding) return next(createError('No active boarding action', HTTP_STATUS.NOT_FOUND));

      const aId = Math.min(attacker_object_id, defender_object_id);
      const bId = Math.max(attacker_object_id, defender_object_id);
      const range = await prisma.combatRange.findFirst({
        where: {
          session_id: sessionId,
          OR: [
            { from_object_id: aId, to_object_id: bId },
            { from_object_id: bId, to_object_id: aId },
          ],
        },
      });

      if (!range || range.band !== 'ADJACENT') {
        await prisma.boardingAction.update({
          where: { session_id: sessionId },
          data: { pacification_paused: true },
        });
        return res.json({ success: true, data: { paused: true } });
      }

      if (boarding.pacification_paused) {
        await prisma.boardingAction.update({
          where: { session_id: sessionId },
          data: { pacification_paused: false },
        });
        return res.json({ success: true, data: { paused: false, resumed: true } });
      }

      res.json({ success: true, data: { paused: false } });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
