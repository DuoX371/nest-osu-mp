import { Injectable } from '@nestjs/common';
import { LobbyFilterInput } from '../../schema';
import { LobbyWhereInput } from 'generated/prisma/internal/prismaNamespaceBrowser';
import { PrismaService } from '@prisma-client/prisma';
import { isEmpty } from '../../util/common.util';
import { PaginationInput } from '../../schema/pagination.schema';

@Injectable()
export class LobbyService {
    constructor(
        private readonly prisma: PrismaService
    ) { }

    async findAll(filter?: LobbyFilterInput, pagination?: PaginationInput) {
        if (isEmpty(filter)) {
           return { lobbies: [], total: 0 }
        };

        const conditions: LobbyWhereInput[] = [];

        if (filter.title) {
            conditions.push({ title: { startsWith: filter.title, mode: 'insensitive' } });
        }

        if (filter.username) {
            if (filter.username.length < 3) {
                return { lobbies: [], total: 0 }
            }
            conditions.push({
                players: {
                    some: {
                        player: {
                            username: { startsWith: filter.username, mode: 'insensitive' }
                        }
                    }
                }
            });
        }

        if (filter.playerId) {
            conditions.push({
                players: {
                    some: {
                        playerId: filter.playerId
                    }
                }
            })
        }

        if (filter.beatmapId) {
            conditions.push({
                beatmaps: {
                    some: { beatmapId: filter.beatmapId }
                }
            })
        }

        const [lobbies, total] = await this.prisma.$transaction([
            this.prisma.lobby.findMany({
                where: { AND: conditions },
                include: {
                    players: { include: { player: true } },
                    beatmaps: { include: { lobby: true } }
                },
                skip: pagination?.skip ?? 0,
                take: Math.min(pagination?.limit ?? 20, 100),
                orderBy: { lobbyId: "desc" },
            }),
            this.prisma.lobby.count({ where: { AND: conditions } })
        ]);

        return { lobbies, total };
    }

    async getLatestLobby() {
        const lobby = await this.prisma.lobby.findFirst({
            orderBy: { lobbyId: 'desc' },
            select: { lobbyId: true }
        });

        return lobby?.lobbyId ?? null;
    }
}
