-- CreateIndex
CREATE INDEX "Beatmap_beatmapId_idx" ON "Beatmap"("beatmapId");

-- CreateIndex
CREATE INDEX "Beatmap_beatmapSetId_idx" ON "Beatmap"("beatmapSetId");

-- CreateIndex
CREATE INDEX "Beatmap_lobbyId_idx" ON "Beatmap"("lobbyId");

-- CreateIndex
CREATE INDEX "Lobby_status_idx" ON "Lobby"("status");

-- CreateIndex
CREATE INDEX "Lobby_title_idx" ON "Lobby"("title");

-- CreateIndex
CREATE INDEX "LobbyPlayer_playerId_idx" ON "LobbyPlayer"("playerId");

-- CreateIndex
CREATE INDEX "LobbyPlayer_lobbyId_idx" ON "LobbyPlayer"("lobbyId");

-- CreateIndex
CREATE INDEX "Player_username_idx" ON "Player"("username");
