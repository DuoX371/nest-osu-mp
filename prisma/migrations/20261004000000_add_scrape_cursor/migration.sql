CREATE TABLE "ScrapeCursor" (
    "id" INTEGER NOT NULL,
    "nextLobbyId" INTEGER NOT NULL,

    CONSTRAINT "ScrapeCursor_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ScrapeCursor" ("id", "nextLobbyId")
SELECT 1, COALESCE(MAX("lobbyId"), 0) + 1 FROM "Lobby";
