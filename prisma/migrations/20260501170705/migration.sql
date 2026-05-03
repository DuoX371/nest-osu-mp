/*
  Warnings:

  - Added the required column `status` to the `Lobby` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `lobbyId` on the `Lobby` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `playerId` on the `Player` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "status" TEXT NOT NULL,
DROP COLUMN "lobbyId",
ADD COLUMN     "lobbyId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Player" DROP COLUMN "playerId",
ADD COLUMN     "playerId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Beatmap" (
    "id" SERIAL NOT NULL,
    "beatmapId" INTEGER NOT NULL,
    "beatmapSetId" INTEGER NOT NULL,
    "lobbyId" INTEGER NOT NULL,

    CONSTRAINT "Beatmap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Beatmap_beatmapId_key" ON "Beatmap"("beatmapId");

-- CreateIndex
CREATE UNIQUE INDEX "Beatmap_lobbyId_beatmapId_key" ON "Beatmap"("lobbyId", "beatmapId");

-- CreateIndex
CREATE UNIQUE INDEX "Lobby_lobbyId_key" ON "Lobby"("lobbyId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_playerId_key" ON "Player"("playerId");

-- AddForeignKey
ALTER TABLE "Beatmap" ADD CONSTRAINT "Beatmap_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
