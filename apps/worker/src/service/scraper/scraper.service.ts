import { PUB_SUB } from '@common/common/pubsub/pubsub.module';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OsuService } from '@osu/osu';
import { OsuMatchFormatted } from '@osu/osu/osu.types';
import { PrismaService } from '@prisma-client/prisma';
import { LOBBY_ADDED } from 'apps/api/src/resolver/lobby/lobby.resolver';
import { PubSub } from 'graphql-subscriptions';

@Injectable()
export class ScraperService {
    private readonly logger = new Logger(ScraperService.name);
    private isRunning = false;

    constructor(
        private readonly osuService: OsuService,
        private readonly prisma: PrismaService,
        @Inject(PUB_SUB) private readonly pubSub: PubSub,
    ) { }

    @Cron(CronExpression.EVERY_MINUTE)
    async fetchNewMatches() {
        if (this.isRunning) {
            this.logger.warn("Scraper running. Skipping cron task");
            return;
        }

        this.isRunning = true;

        try {
            const latest = await this.prisma.lobby.findFirst({
                orderBy: { lobbyId: "desc" },
                select: { lobbyId: true },
            });

            const startId = latest ? latest.lobbyId + 1 : 1;
            this.logger.log(`New scrape from lobbyId: ${startId}`);

            let currentId = startId;
            let consecutiveFail = 0;
            const MAX_CONSECUTIVE_FAILS = 3;
            const BATCH_SIZE = 10;

            // Temporary
            // while (consecutiveFail < MAX_CONSECUTIVE_FAILS) {
            //     const batchIds = Array.from(
            //         { length: BATCH_SIZE },
            //         (_, i) => currentId + i
            //     );

            //     const results = await Promise.all(
            //         batchIds.map((id) =>
            //             this.scrapeMatch(id)
            //                 .then(() => ({ id, success: true }))
            //                 .catch((e) => {
            //                     this.logger.error(`Error on lobbyId ${id}: ${e.message}`);
            //                     return { id, success: false };
            //                 }),
            //         ),
            //     );

            //     // process results in order to track consecutive fails correctly
            //     let shouldStop = false;
            //     for (const result of results) {
            //         if (result.success) {
            //             consecutiveFail = 0;
            //         } else {
            //             consecutiveFail++;
            //             this.logger.warn(
            //                 `Failed lobbyId ${result.id} (${consecutiveFail}/${MAX_CONSECUTIVE_FAILS})`,
            //             );

            //             if (consecutiveFail >= MAX_CONSECUTIVE_FAILS) {
            //                 shouldStop = true;
            //                 break;
            //             }
            //         }
            //     }

            //     currentId += BATCH_SIZE;

            //     if (shouldStop) break;
            // }
            while (consecutiveFail < MAX_CONSECUTIVE_FAILS) {
                const sucess = await this.scrapeMatch(currentId).catch(e => {
                    this.logger.error(e)
                    return false;
                })

                if (sucess) {
                    consecutiveFail = 0;
                    currentId++;
                } else {
                    consecutiveFail++;
                    this.logger.warn(
                        `Failed to fetch lobbyId ${currentId} (${consecutiveFail}/${MAX_CONSECUTIVE_FAILS})`,
                    );
                }
            }
            this.logger.log(`Scrape completed. Current Lobby: ${currentId}`);
        } catch (error) {
            this.logger.error("Scrapper crashed:", error)
        } finally {
            this.isRunning = false;
        }
    }

    async scrapeMatch(matchId: number) {
        this.logger.log(`Scraping data for match ${matchId}...`);

        const match = await this.osuService.getMatch(matchId);
        if (!match) {
            this.logger.log(`Skipping match: ${matchId}`);
            return true;
        }
        const formatted = this.osuService.extractDetails(match);

        await this.saveMatchData(formatted);
        this.pubSub.publish(LOBBY_ADDED, { latestLobbyId: formatted.lobbyId });
        this.logger.log(`Finished scraping and saving data for match ${matchId}`);
        return true;
    }

    private async saveMatchData(data: OsuMatchFormatted) {
        if (data.maps.length > 30) {
            this.logger.log(`Skipping match with more than 30 beatmaps: ${data.lobbyId}`);
            return;
        }
        return this.prisma.$transaction(async (prisma) => {
            await prisma.lobby.upsert({
                where: { lobbyId: data.lobbyId },
                create: {
                    lobbyId: data.lobbyId,
                    title: data.title,
                    createdAt: data.createdAt,
                    status: data.status
                },
                update: {
                    title: data.title,
                    status: data.status
                }
            });

            // Upsert players
            for (const player of data.players) {
                const p = await prisma.player.upsert({
                    where: { playerId: player.playerId },
                    create: {
                        playerId: player.playerId,
                        username: player.username
                    },
                    update: {
                        username: player.username
                    }
                });

                await prisma.lobbyPlayer.upsert({
                    where: {
                        lobbyId_playerId: {
                            lobbyId: data.lobbyId,
                            playerId: p.playerId
                        }
                    },
                    create: {
                        lobbyId: data.lobbyId,
                        playerId: p.playerId
                    },
                    update: {},
                });
            }

            for (const map of data.maps) {
                await prisma.beatmap.upsert({
                    where: {
                        lobbyId_beatmapId: {
                            lobbyId: data.lobbyId,
                            beatmapId: map.beatmapId
                        }
                    },
                    create: {
                        beatmapId: map.beatmapId,
                        beatmapSetId: map.beatmapsetId,
                        lobbyId: data.lobbyId
                    },
                    update: {}
                })
            }
        });
    }
}
