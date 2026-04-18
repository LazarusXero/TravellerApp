-- CreateTable
CREATE TABLE "StoreInventory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "game_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "base_roll" INTEGER NOT NULL,
    "final_roll" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price_multiplier" REAL NOT NULL DEFAULT 1.0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "StoreInventory_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "Game" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StoreInventory_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreInventory_game_id_item_id_key" ON "StoreInventory"("game_id", "item_id");
