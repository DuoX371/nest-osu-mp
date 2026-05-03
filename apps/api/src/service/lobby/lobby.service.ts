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
            return [];
        }

        const where: LobbyWhereInput = {};

        if (filter.title) {
            where.title = { contains: filter.title, mode: 'insensitive' };
        }

        if (filter.playerId || filter.username) {
            where.players = {
                some: {
                    ...(filter.playerId && { playerId: filter.playerId }),
                    ...(filter.username && {
                        player: {
                            username: {
                                contains: filter.username,
                                mode: 'insensitive'
                            }
                        }
                    })
                }
            };
        }

        if (filter.beatmapsetId) {
            where.beatmaps = {
                some: {
                    beatmapSetId: filter.beatmapsetId
                }
            }
        }

        return this.prisma.lobby.findMany({
            where,
            include: {
                players: { include: { player: true } }
            },
            skip: pagination?.skip ?? 0,
            take: Math.min(pagination?.limit ?? 20, 100),
            orderBy: { lobbyId: "desc" },
        });
    }
}
