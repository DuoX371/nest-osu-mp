/*
  Warnings:

  - The primary key for the `Lobby` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Lobby` table. All the data in the column will be lost.
  - The primary key for the `Player` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Player` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Beatmap" DROP CONSTRAINT "Beatmap_lobbyId_fkey";

-- DropForeignKey
ALTER TABLE "LobbyPlayer" DROP CONSTRAINT "LobbyPlayer_lobbyId_fkey";

-- DropForeignKey
ALTER TABLE "LobbyPlayer" DROP CONSTRAINT "LobbyPlayer_playerId_fkey";

-- DropIndex
DROP INDEX "Lobby_lobbyId_key";

-- DropIndex
DROP INDEX "Player_playerId_key";

-- AlterTable
ALTER TABLE "Lobby" DROP CONSTRAINT "Lobby_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Lobby_pkey" PRIMARY KEY ("lobbyId");

-- AlterTable
ALTER TABLE "Player" DROP CONSTRAINT "Player_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Player_pkey" PRIMARY KEY ("playerId");

-- AddForeignKey
ALTER TABLE "LobbyPlayer" ADD CONSTRAINT "LobbyPlayer_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("lobbyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyPlayer" ADD CONSTRAINT "LobbyPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("playerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beatmap" ADD CONSTRAINT "Beatmap_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("lobbyId") ON DELETE RESTRICT ON UPDATE CASCADE;
