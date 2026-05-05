-- CreateTable
CREATE TABLE "CombatSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "game_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "current_phase" TEXT NOT NULL DEFAULT 'SETUP',
    "current_round" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" DATETIME
);

-- CreateTable
CREATE TABLE "CombatObject" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" INTEGER NOT NULL,
    "ship_id" INTEGER,
    "object_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_player_ship" BOOLEAN NOT NULL DEFAULT false,
    "is_destroyed" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "added_round" INTEGER NOT NULL DEFAULT 1,
    "initiative" INTEGER,
    "move_intent" TEXT,
    "move_target_id" INTEGER,
    "thrust_spent" INTEGER NOT NULL DEFAULT 0,
    "tl" INTEGER,
    "size_tons" INTEGER,
    "max_thrust" INTEGER,
    "adjusted_max_thrust" INTEGER,
    "current_thrust" INTEGER,
    "base_armor" INTEGER,
    "current_armor" INTEGER,
    "hull_max" INTEGER,
    "hull_current" INTEGER,
    "hull_severity" INTEGER NOT NULL DEFAULT 0,
    "sustained_damage_threshold" INTEGER,
    "fuel_capacity" REAL,
    "fuel_current" REAL,
    "fuel_leak_rate" REAL NOT NULL DEFAULT 0,
    "fuel_tank_status" TEXT,
    "power_max" REAL,
    "power_used" REAL,
    "computer_rating" INTEGER,
    "current_computer_rating" INTEGER,
    "computer_status" TEXT,
    "life_support_status" TEXT,
    "life_support_timer" INTEGER,
    "j_drive_check_dm" INTEGER NOT NULL DEFAULT 0,
    "j_drive_status" TEXT,
    "m_drive_check_dm" INTEGER NOT NULL DEFAULT 0,
    "m_drive_thrust_mod" INTEGER NOT NULL DEFAULT 0,
    "m_drive_status" TEXT,
    "cargo_weight" REAL,
    "cargo_value" REAL,
    "cargo_status" TEXT,
    "sensor_check_dm" INTEGER NOT NULL DEFAULT 0,
    "sensor_range" TEXT,
    "sensor_status" TEXT,
    "sensor_lock_status" TEXT NOT NULL DEFAULT 'NO SENSOR LOCK',
    "comms_jammed" BOOLEAN NOT NULL DEFAULT false,
    "overload_drive_dm" INTEGER NOT NULL DEFAULT 0,
    "overload_power_dm" INTEGER NOT NULL DEFAULT 0,
    "increase_thrust_next" BOOLEAN NOT NULL DEFAULT false,
    "increase_power_next" BOOLEAN NOT NULL DEFAULT false,
    "ew_used" BOOLEAN NOT NULL DEFAULT false,
    "leadership_effect" INTEGER NOT NULL DEFAULT 0,
    "pilot_skill_dm" INTEGER,
    "leadership_skill_dm" INTEGER,
    "naval_tactics_dm" INTEGER,
    "captain_soc_dm" INTEGER,
    "gunner_skill_dm" INTEGER,
    "gunner_dex_dm" INTEGER,
    "engineer_skill_dm" INTEGER,
    "engineer_int_dm" INTEGER,
    "sensor_op_skill_dm" INTEGER,
    "sensor_op_int_dm" INTEGER,
    "marines" INTEGER NOT NULL DEFAULT 0,
    "passengers" INTEGER NOT NULL DEFAULT 0,
    "origin_object_id" INTEGER,
    "target_object_id" INTEGER,
    "missile_thrust" INTEGER,
    "missile_quantity" INTEGER,
    "rounds_to_contact" INTEGER,
    "radius_km" INTEGER,
    "jump_distance_km" INTEGER,
    CONSTRAINT "CombatObject_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "CombatSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CombatObject_ship_id_fkey" FOREIGN KEY ("ship_id") REFERENCES "Ship" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CombatRange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" INTEGER NOT NULL,
    "from_object_id" INTEGER NOT NULL,
    "to_object_id" INTEGER NOT NULL,
    "thrust_points" INTEGER NOT NULL DEFAULT 44,
    "band" TEXT NOT NULL DEFAULT 'VERY LONG',
    "last_updated_round" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "CombatRange_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "CombatSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CombatRange_from_object_id_fkey" FOREIGN KEY ("from_object_id") REFERENCES "CombatObject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CombatRange_to_object_id_fkey" FOREIGN KEY ("to_object_id") REFERENCES "CombatObject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CombatSystemHit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" INTEGER NOT NULL,
    "object_id" INTEGER NOT NULL,
    "system_name" TEXT NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "max_severity" INTEGER NOT NULL DEFAULT 1,
    "repaired" BOOLEAN NOT NULL DEFAULT false,
    "beyond_repair" BOOLEAN NOT NULL DEFAULT false,
    "recorded_round" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CombatSystemHit_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "CombatSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CombatSystemHit_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "CombatObject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CombatWeaponMount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "object_id" INTEGER NOT NULL,
    "mount_type" TEXT NOT NULL,
    "mount_status" TEXT NOT NULL DEFAULT 'Operational',
    "point_defense_dm" INTEGER NOT NULL DEFAULT 0,
    "ammo_status" TEXT NOT NULL DEFAULT 'Full',
    CONSTRAINT "CombatWeaponMount_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "CombatObject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CombatWeapon" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mount_id" INTEGER NOT NULL,
    "weapon_type" TEXT NOT NULL,
    "damage" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "traits" TEXT,
    "ammo_count" INTEGER NOT NULL DEFAULT 0,
    "power_required" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CombatWeapon_mount_id_fkey" FOREIGN KEY ("mount_id") REFERENCES "CombatWeaponMount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CombatCrewMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "object_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "hp_max" INTEGER NOT NULL,
    "hp_current" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    CONSTRAINT "CombatCrewMember_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "CombatObject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RepairProgress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "object_id" INTEGER NOT NULL,
    "character_id" INTEGER NOT NULL,
    "system_name" TEXT NOT NULL,
    "consecutive_bonus" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RepairProgress_object_id_fkey" FOREIGN KEY ("object_id") REFERENCES "CombatObject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BoardingAction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" INTEGER NOT NULL,
    "attacker_object_id" INTEGER NOT NULL,
    "defender_object_id" INTEGER NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'RESOLUTION',
    "rounds_remaining" INTEGER,
    "pacification_timer" INTEGER,
    "pacification_paused" BOOLEAN NOT NULL DEFAULT false,
    "carry_forward_dm" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "BoardingAction_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "CombatSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CombatConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CombatRange_session_id_from_object_id_to_object_id_key" ON "CombatRange"("session_id", "from_object_id", "to_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "CombatSystemHit_session_id_object_id_system_name_key" ON "CombatSystemHit"("session_id", "object_id", "system_name");

-- CreateIndex
CREATE UNIQUE INDEX "RepairProgress_object_id_character_id_key" ON "RepairProgress"("object_id", "character_id");

-- CreateIndex
CREATE UNIQUE INDEX "BoardingAction_session_id_key" ON "BoardingAction"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "CombatConfig_key_key" ON "CombatConfig"("key");
