/*
  Warnings:

  - Added the required column `updated_at` to the `Character` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "CharacterSkill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "characterId" INTEGER NOT NULL,
    "skillName" TEXT NOT NULL,
    "level" INTEGER,
    CONSTRAINT "CharacterSkill_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Character" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "player_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "homeworld" TEXT,
    "background" TEXT,
    "notes" TEXT,
    "portrait_url" TEXT,
    "description" TEXT,
    "colorScheme" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
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
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Character_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Character" ("action_type_today", "actions_spent_day", "created_at", "credits", "description", "dex", "edu", "end", "id", "int", "last_salary_day", "name", "player_id", "portrait_url", "salary_amount", "salary_interval_days", "skill_points", "skills", "soc", "str", "total_sp_earned") SELECT "action_type_today", "actions_spent_day", "created_at", "credits", "description", "dex", "edu", "end", "id", "int", "last_salary_day", "name", "player_id", "portrait_url", "salary_amount", "salary_interval_days", "skill_points", "skills", "soc", "str", "total_sp_earned" FROM "Character";
DROP TABLE "Character";
ALTER TABLE "new_Character" RENAME TO "Character";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CharacterSkill_characterId_skillName_key" ON "CharacterSkill"("characterId", "skillName");
