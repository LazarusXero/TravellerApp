/*
  Warnings:

  - You are about to drop the `WorldInventory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "WorldInventory";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "BMInventory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "world_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "visit_day" INTEGER NOT NULL,
    "bm_base_roll" INTEGER NOT NULL,
    "bm_final_roll" INTEGER,
    "bm_quantity" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "BMInventory_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "World" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BMInventory_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlackMarketUnlock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "world_id" INTEGER NOT NULL,
    "item_type" TEXT NOT NULL,
    "item_sub_type" TEXT NOT NULL,
    "is_unlocked" BOOLEAN NOT NULL DEFAULT false,
    "streetwise_dm" INTEGER NOT NULL DEFAULT 0,
    "unlocked_by" TEXT,
    "unlocked_day" INTEGER,
    "gm_override" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "BlackMarketUnlock_world_id_fkey" FOREIGN KEY ("world_id") REFERENCES "World" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BMInventory_world_id_item_id_key" ON "BMInventory"("world_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "BlackMarketUnlock_world_id_item_type_item_sub_type_key" ON "BlackMarketUnlock"("world_id", "item_type", "item_sub_type");
