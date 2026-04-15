-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sub_type" TEXT NOT NULL,
    "tech_level" INTEGER NOT NULL,
    "law_level" INTEGER NOT NULL DEFAULT 0,
    "black_market_category" INTEGER NOT NULL DEFAULT 0,
    "cost_cr" REAL NOT NULL,
    "mass_kg" REAL,
    "damage" TEXT,
    "protection" TEXT,
    "magazine_qty" INTEGER,
    "slots" INTEGER,
    "radiation_protection" INTEGER,
    "traits" TEXT,
    "range" TEXT,
    "required_skill" TEXT,
    "reference" TEXT,
    "description" TEXT,
    "active_in_game" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Item" ("active_in_game", "black_market_category", "created_at", "damage", "id", "law_level", "name", "protection", "range", "reference", "required_skill", "sub_type", "tech_level", "traits", "type") SELECT "active_in_game", coalesce("black_market_category", 0) AS "black_market_category", "created_at", "damage", "id", coalesce("law_level", 0) AS "law_level", "name", "protection", "range", "reference", "required_skill", "sub_type", "tech_level", "traits", "type" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
