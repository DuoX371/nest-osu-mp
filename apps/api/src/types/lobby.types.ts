import { Prisma } from "generated/prisma/client";

export type LobbyWithPlayers = Prisma.LobbyGetPayload<{
    include: {
        players: { include: { player: true } };
    };
}>;
