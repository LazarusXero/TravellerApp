-- CreateTable
CREATE TABLE "CharacterCombatRole" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" INTEGER NOT NULL,
    "character_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "mount_id" INTEGER,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "CharacterCombatRole_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "CombatSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CharacterCombatRole_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "Character" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CharacterCombatRole_session_id_character_id_key" ON "CharacterCombatRole"("session_id", "character_id");
