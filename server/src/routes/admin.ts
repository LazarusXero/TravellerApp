import { Router, Request, Response, NextFunction } from 'express';
import { readFile } from 'fs/promises';
import path from 'path';
import { prisma } from '../engine/index.js';
import { createError } from '../middleware/index.js';
import { HTTP_STATUS } from '../constants/index.js';

const router = Router();

// Server CWD is <project root>/server (set by npm --prefix),
// so ../temp resolves to <project root>/temp.
const WORLDS_FILE = path.resolve(process.cwd(), '../temp/worlds_data.json');

interface WorldInput {
  name: string;
  hex_code: string;
  port_type: string;
  size: string;
  atmosphere: string;
  hydrographics: string;
  population: string;
  government: string;
  law: string;
  technology: string;
  trade_codes?: string | null;
  allegiance?: string | null;
  port_attitude?: string | null;
  naval_base?: boolean;
  key_system?: boolean;
  secure_world?: boolean;
  dangerous_world?: boolean;
  is_hidden?: boolean;
  is_aslan_port?: boolean;
  total_donations_cr?: number;
  last_supplier_search_day?: number | null;
  crew_available?: boolean;
  sector?: string | null;
  subsector?: string | null;
  notes?: string | null;
}

// POST /api/admin/reset-worlds
// Reads temp/worlds_data.json from project root, wipes World table, bulk-inserts all rows.
router.post('/reset-worlds', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Read the JSON file
    let raw: string;
    try {
      raw = await readFile(WORLDS_FILE, 'utf-8');
    } catch {
      return next(
        createError(
          `Could not read ${WORLDS_FILE} — make sure temp/worlds_data.json exists in the project root`,
          HTTP_STATUS.BAD_REQUEST
        )
      );
    }

    let worlds: WorldInput[];
    try {
      worlds = JSON.parse(raw) as WorldInput[];
    } catch {
      return next(createError('worlds_data.json is not valid JSON', HTTP_STATUS.BAD_REQUEST));
    }

    if (!Array.isArray(worlds) || worlds.length === 0) {
      return next(createError('worlds_data.json must be a non-empty array', HTTP_STATUS.BAD_REQUEST));
    }

    // Wipe existing worlds, then bulk-insert
    await prisma.world.deleteMany();
    const result = await prisma.world.createMany({ data: worlds });

    res.json({ success: true, count: result.count });
  } catch (error) {
    next(error);
  }
});

export default router;
