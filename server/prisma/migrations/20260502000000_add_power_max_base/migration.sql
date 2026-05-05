-- Add power_max_base to CombatObject
-- Stores the original (unmodified) power_max so it can be restored on repair.
-- Backfills existing rows: set power_max_base = power_max (current value, pre-crit baseline).

ALTER TABLE "CombatObject" ADD COLUMN "power_max_base" REAL;

UPDATE "CombatObject" SET "power_max_base" = "power_max" WHERE "power_max" IS NOT NULL;
