-- CreateTable
CREATE TABLE "Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'player',
    "pin_hash" TEXT NOT NULL,
    "active_character_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Player_active_character_id_fkey" FOREIGN KEY ("active_character_id") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Character" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "player_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "portrait_url" TEXT,
    "description" TEXT,
    "str" INTEGER NOT NULL DEFAULT 7,
    "dex" INTEGER NOT NULL DEFAULT 7,
    "end" INTEGER NOT NULL DEFAULT 7,
    "int" INTEGER NOT NULL DEFAULT 7,
    "edu" INTEGER NOT NULL DEFAULT 7,
    "soc" INTEGER NOT NULL DEFAULT 7,
    "skills" TEXT NOT NULL DEFAULT '{}',
    "credits" INTEGER NOT NULL DEFAULT 0,
    "actions_spent_day" INTEGER,
    "action_type_today" TEXT,
    "salary_amount" INTEGER,
    "salary_interval_days" INTEGER,
    "last_salary_day" INTEGER,
    "skill_points" INTEGER NOT NULL DEFAULT 0,
    "total_sp_earned" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Character_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Game" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "current_world_id" INTEGER,
    "in_jump_space" BOOLEAN NOT NULL DEFAULT false,
    "day" INTEGER NOT NULL DEFAULT 1,
    "milieu" TEXT,
    "is_drinax" BOOLEAN NOT NULL DEFAULT true,
    "imperium_standing" INTEGER NOT NULL DEFAULT 0,
    "hierate_standing" INTEGER NOT NULL DEFAULT -5,
    "imperium_bounty" INTEGER,
    "hierate_bounty" INTEGER,
    "combat_round" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Game_current_world_id_fkey" FOREIGN KEY ("current_world_id") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sub_type" TEXT NOT NULL,
    "tech_level" TEXT NOT NULL,
    "law_level" TEXT,
    "cost" INTEGER NOT NULL,
    "cost_unit" TEXT NOT NULL DEFAULT 'Cr',
    "mass" REAL,
    "mass_unit" TEXT NOT NULL DEFAULT 'kg',
    "black_market_category" TEXT,
    "damage" TEXT,
    "protection" TEXT,
    "traits" TEXT,
    "range" TEXT,
    "required_skill" TEXT,
    "reference" TEXT,
    "active_in_game" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SkillTraining" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "character_id" INTEGER NOT NULL,
    "skill_name" TEXT NOT NULL,
    "training_days_applied" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "started_day" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillTraining_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillPointAward" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "character_id" INTEGER NOT NULL,
    "points_awarded" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "skill_name" TEXT,
    "reason" TEXT,
    "game_day" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillPointAward_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "World" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "hex_code" TEXT NOT NULL,
    "port_type" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "atmosphere" TEXT NOT NULL,
    "hydrographics" TEXT NOT NULL,
    "population" TEXT NOT NULL,
    "government" TEXT NOT NULL,
    "law" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "trade_codes" TEXT,
    "allegiance" TEXT,
    "port_attitude" TEXT,
    "naval_base" BOOLEAN NOT NULL DEFAULT false,
    "key_system" BOOLEAN NOT NULL DEFAULT false,
    "secure_world" BOOLEAN NOT NULL DEFAULT false,
    "dangerous_world" BOOLEAN NOT NULL DEFAULT false,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "is_aslan_port" BOOLEAN NOT NULL DEFAULT false,
    "total_donations_cr" INTEGER NOT NULL DEFAULT 0,
    "last_supplier_search_day" INTEGER,
    "crew_available" BOOLEAN NOT NULL DEFAULT false,
    "sector" TEXT,
    "subsector" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WorldInventory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "world_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "visit_day" INTEGER NOT NULL,
    "roll" INTEGER NOT NULL,
    "effective_roll" INTEGER NOT NULL,
    "bm_roll" INTEGER,
    "effective_bm_roll" INTEGER,
    "bm_searcher_name" TEXT,
    "bm_search_day" INTEGER,
    "quantity_available" INTEGER NOT NULL DEFAULT 1,
    "gm_override" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldInventory_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "World" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorldInventory_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorldNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "world_id" INTEGER NOT NULL,
    "character_id" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "WorldNote_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "World" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorldNote_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NPC" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "world_id" INTEGER,
    "faction_id" INTEGER,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "occupation" TEXT,
    "alignment" TEXT,
    "reports_to_type" TEXT,
    "reports_to_id" INTEGER,
    "mission_text" TEXT,
    "total_investment" INTEGER NOT NULL DEFAULT 0,
    "soc" INTEGER NOT NULL DEFAULT 7,
    "ac" INTEGER NOT NULL DEFAULT 0,
    "last_investment_week" INTEGER,
    "skills" TEXT NOT NULL DEFAULT '{}',
    "portrait_url" TEXT,
    "is_revealed" BOOLEAN NOT NULL DEFAULT false,
    "is_hireable" BOOLEAN NOT NULL DEFAULT false,
    "hire_cost" INTEGER,
    "party_alignment" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NPC_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NPC_faction_id_fkey" FOREIGN KEY ("faction_id") REFERENCES "Faction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Faction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "alignment" TEXT,
    "size_code" INTEGER NOT NULL,
    "world_id" INTEGER NOT NULL,
    "interaction_cost" INTEGER NOT NULL DEFAULT 0,
    "total_investment" INTEGER NOT NULL DEFAULT 0,
    "mission_text" TEXT,
    "portrait_url" TEXT,
    "is_revealed" BOOLEAN NOT NULL DEFAULT false,
    "party_alignment" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Faction_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "World" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PiracyEffect" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "world_id" INTEGER NOT NULL,
    "source_events" TEXT NOT NULL DEFAULT '[]',
    "effect_start_level" REAL NOT NULL,
    "effect_day_start" INTEGER NOT NULL,
    "decay_rate" REAL NOT NULL,
    "buy_price_modifier" REAL NOT NULL DEFAULT 0,
    "sell_price_modifier" REAL NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "PiracyEffect_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "World" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EncounterTable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "world_type" TEXT NOT NULL,
    "environment" TEXT,
    "min_roll" INTEGER NOT NULL,
    "max_roll" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "generates_npc" BOOLEAN NOT NULL DEFAULT false,
    "npc_template" TEXT,
    "source" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SpecCargo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "world_id" INTEGER NOT NULL,
    "trade_good" TEXT NOT NULL,
    "trade_code" TEXT NOT NULL,
    "tons_available" INTEGER NOT NULL,
    "base_price_per_ton" INTEGER NOT NULL,
    "visit_day" INTEGER NOT NULL,
    "tons_taken" INTEGER NOT NULL DEFAULT 0,
    "supplier_type" TEXT NOT NULL DEFAULT 'standard',
    "search_attempts_this_month" INTEGER NOT NULL DEFAULT 0,
    "rejected_day" INTEGER,
    "purchase_pct" INTEGER,
    "is_illegal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpecCargo_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "World" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CargoHold" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "spec_cargo_id" INTEGER NOT NULL,
    "character_id" INTEGER NOT NULL,
    "tons_purchased" INTEGER NOT NULL,
    "purchase_price_per_ton" INTEGER NOT NULL,
    "purchased_day" INTEGER NOT NULL,
    "sold_at_world_id" INTEGER,
    "sale_price_per_ton" INTEGER,
    "sale_pct" INTEGER,
    "buyer_rejected_day" INTEGER,
    "sold_day" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CargoHold_spec_cargo_id_fkey" FOREIGN KEY ("spec_cargo_id") REFERENCES "SpecCargo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CargoHold_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CargoHold_sold_at_world_id_fkey" FOREIGN KEY ("sold_at_world_id") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FreightLot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "origin_world_id" INTEGER NOT NULL,
    "destination_world_id" INTEGER NOT NULL,
    "tons" INTEGER NOT NULL,
    "freight_class" TEXT NOT NULL,
    "fee_per_ton" INTEGER NOT NULL,
    "is_hazardous" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'available',
    "generated_day" INTEGER NOT NULL,
    "accepted_day" INTEGER,
    "delivered_day" INTEGER,
    "gm_qty_override" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FreightLot_origin_world_id_fkey" FOREIGN KEY ("origin_world_id") REFERENCES "World" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FreightLot_destination_world_id_fkey" FOREIGN KEY ("destination_world_id") REFERENCES "World" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Passenger" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "origin_world_id" INTEGER NOT NULL,
    "destination_world_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "berth_class" TEXT NOT NULL,
    "passage_fee" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "generated_day" INTEGER NOT NULL,
    "accepted_day" INTEGER,
    "delivered_day" INTEGER,
    "incident_notes" TEXT,
    "luggage_tons" REAL NOT NULL DEFAULT 0,
    "gm_qty_override" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Passenger_origin_world_id_fkey" FOREIGN KEY ("origin_world_id") REFERENCES "World" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Passenger_destination_world_id_fkey" FOREIGN KEY ("destination_world_id") REFERENCES "World" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "item_id" INTEGER NOT NULL,
    "owner_type" TEXT NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "purchased_price" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryItem_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvestmentAction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "target_type" TEXT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "character_id" INTEGER NOT NULL,
    "action_type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "av_at_time" INTEGER NOT NULL,
    "skill_used" TEXT,
    "game_day" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentAction_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "NPC" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InvestmentAction_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "Faction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InvestmentAction_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ship" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "ship_class" TEXT NOT NULL,
    "displacement_tons" INTEGER NOT NULL,
    "hull_points" INTEGER NOT NULL,
    "hull_damage" INTEGER NOT NULL DEFAULT 0,
    "hull_severity" INTEGER NOT NULL DEFAULT 0,
    "jump_rating" INTEGER NOT NULL,
    "thrust_rating" INTEGER NOT NULL,
    "current_thrust" INTEGER,
    "fuel_capacity" INTEGER NOT NULL,
    "fuel_current" INTEGER NOT NULL,
    "cargo_capacity" INTEGER NOT NULL,
    "staterooms" INTEGER NOT NULL DEFAULT 0,
    "cryopods" INTEGER NOT NULL DEFAULT 0,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "mortgage_per_month" INTEGER,
    "armour" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ShipSystem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ship_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "system_type" TEXT NOT NULL,
    "damage_state" TEXT NOT NULL DEFAULT 'operational',
    "damage_notes" TEXT,
    "hull_severity" INTEGER NOT NULL DEFAULT 0,
    "maintenance_interval_days" INTEGER NOT NULL DEFAULT 30,
    "last_maintained_day" INTEGER,
    "maintenance_due_day" INTEGER,
    "overdue_penalty" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShipSystem_ship_id_fkey" FOREIGN KEY ("ship_id") REFERENCES "Ship" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShipWeapon" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ship_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "weapon_type" TEXT NOT NULL,
    "mount_type" TEXT NOT NULL,
    "tech_level" INTEGER NOT NULL,
    "damage" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "ammo_current" INTEGER,
    "ammo_max" INTEGER,
    "ammo_refill_cost" INTEGER,
    "damage_state" TEXT NOT NULL DEFAULT 'operational',
    "hull_severity" INTEGER NOT NULL DEFAULT 0,
    "turret_group" INTEGER,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShipWeapon_ship_id_fkey" FOREIGN KEY ("ship_id") REFERENCES "Ship" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ship_system_id" INTEGER,
    "character_id" INTEGER NOT NULL,
    "action_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cost" INTEGER,
    "game_day" INTEGER NOT NULL,
    "actions_consumed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceLog_ship_system_id_fkey" FOREIGN KEY ("ship_system_id") REFERENCES "ShipSystem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceLog_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrewMember" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "quality_tier" TEXT NOT NULL,
    "specialty_skill" TEXT NOT NULL,
    "specialty_dm" INTEGER NOT NULL,
    "other_skills_dm" INTEGER NOT NULL,
    "base_salary" INTEGER NOT NULL,
    "monthly_salary" INTEGER NOT NULL,
    "salary_arrears" INTEGER NOT NULL DEFAULT 0,
    "hired_day" INTEGER NOT NULL,
    "last_paid_day" INTEGER,
    "last_retention_day" INTEGER,
    "last_retention_week" INTEGER,
    "is_leaving" BOOLEAN NOT NULL DEFAULT false,
    "hired_by_character_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrewMember_hired_by_character_id_fkey" FOREIGN KEY ("hired_by_character_id") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MissileSalvo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "launched_day" INTEGER NOT NULL,
    "launched_round" INTEGER NOT NULL,
    "range_band" TEXT NOT NULL,
    "missile_count" INTEGER NOT NULL,
    "rounds_to_impact" INTEGER NOT NULL,
    "rounds_elapsed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'in_flight',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "game_day" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "character_id" INTEGER,
    "world_id" INTEGER,
    "description" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventLog_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "Character" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EventLog_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "World" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "from_player_id" INTEGER NOT NULL,
    "to_player_id" INTEGER,
    "recipient_type" TEXT NOT NULL DEFAULT 'all',
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "game_day" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_from_player_id_fkey" FOREIGN KEY ("from_player_id") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_to_player_id_fkey" FOREIGN KEY ("to_player_id") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

