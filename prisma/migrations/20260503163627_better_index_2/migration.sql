-- DropIndex
DROP INDEX "Beatmap_beatmapId_idx";

-- DropIndex
DROP INDEX "Beatmap_beatmapSetId_idx";

-- DropIndex
DROP INDEX "Beatmap_lobbyId_idx";

-- DropIndex
DROP INDEX "Lobby_title_idx";

-- DropIndex
DROP INDEX "LobbyPlayer_lobbyId_idx";

-- DropIndex
DROP INDEX "LobbyPlayer_playerId_idx";

-- DropIndex
DROP INDEX "Player_username_idx";

-- CreateIndex
CREATE INDEX "Beatmap_beatmapId_lobbyId_idx" ON "Beatmap"("beatmapId", "lobbyId");

-- CreateIndex
CREATE INDEX "Lobby_title_idx" ON "Lobby"("title" text_pattern_ops);

-- CreateIndex
CREATE INDEX "LobbyPlayer_playerId_lobbyId_idx" ON "LobbyPlayer"("playerId", "lobbyId");

-- CreateIndex
CREATE INDEX "LobbyPlayer_lobbyId_playerId_idx" ON "LobbyPlayer"("lobbyId", "playerId");

-- CreateIndex
CREATE INDEX "Player_username_idx" ON "Player"("username" text_pattern_ops);
