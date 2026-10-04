import { PUB_SUB } from '@common/common/pubsub/pubsub.module';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OsuService } from '@osu/osu';
import { OsuMatchFormatted } from '@osu/osu/osu.types';
import { PrismaService } from '@prisma-client/prisma';
import { LOBBY_ADDED } from 'apps/api/src/resolver/lobby/lobby.resolver';
import { PubSub } from 'graphql-subscriptions';
import pLimit from 'p-limit';
import { isAxiosError } from 'axios';

@Injectable()
export class ScraperService {
    private readonly logger = new Logger(ScraperService.name);
    private isRunning = false;
    private isUpdating = false;

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
            const cursor = await this.prisma.scrapeCursor.findUniqueOrThrow({
                where: { id: 1 },
            });
            let currentId = cursor.nextLobbyId;
            const latestId = await this.osuService.getLatestMatchId();
            const MAX_IDS_PER_RUN = 300;
            const lastId = Math.min(latestId, currentId + MAX_IDS_PER_RUN - 1);
            this.logger.log(`New scrape from lobbyId: ${currentId} through ${lastId} (latest: ${latestId})`);

            while (currentId <= lastId) {
                try {
                    await this.scrapeMatch(currentId);
                } catch (error) {
                    if (!isAxiosError(error) || error.response?.status !== 404) {
                        const message = error instanceof Error ? error.message : String(error);
                        this.logger.error(`Failed to scrape lobbyId ${currentId}; will retry next run: ${message}`);
                        break;
                    }

                    this.logger.log(`No match at lobbyId ${currentId}`);
                }

                await this.prisma.scrapeCursor.update({
                    where: { id: 1 },
                    data: { nextLobbyId: currentId + 1 },
                });
                currentId++;
                if (currentId <= lastId) {
                    await this.waitBetweenMatches();
                }
            }
            this.logger.log(`Scrape completed. Current Lobby: ${currentId}`);
        } catch (error) {
            this.logger.error("Scrapper crashed:", error)
        } finally {
            this.isRunning = false;
        }
    }

    private async waitBetweenMatches() {
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async updateOngoingMatches() {
        if (this.isUpdating) {
            this.logger.warn("Update ongoing already running. Skipping");
            return;
        }

        this.isUpdating = true;

        try {
            const ongoingLobbies = await this.prisma.lobby.findMany({
                where: { status: 'ongoing' },
                select: { lobbyId: true },
            });

            if (ongoingLobbies.length === 0) {
                this.logger.log('No ongoing lobbies to update.');
                return;
            }

            this.logger.log(`Updating ${ongoingLobbies.length} ongoing lobbies...`);

            const limit = pLimit(10); // 10 concurrent requests
            const tasks = ongoingLobbies.map(({ lobbyId }) => {
                return limit(async () => {
                    return this.scrapeMatch(lobbyId).catch((error) => {
                        this.logger.error(error);
                        return false;
                    })
                })
            })

            await Promise.all(tasks);
            this.logger.log('Ongoing lobbies update complete.');
        } catch (error) {
            this.logger.log('Failed to update ongoing lobbies:', error)
        } finally {
            this.isUpdating = false;
        }
    }

    async scrapeMatch(matchId: number) {
        this.logger.log(`Scraping data for match ${matchId}...`);

        const match = await this.osuService.getMatch(matchId);
        if (!match) {
            this.logger.warn(`Skipping inaccessible match ${matchId}`);
            return false;
        }
        const formatted = this.osuService.extractDetails(match);

        await this.saveMatchData(formatted);
        await this.pubSub.publish(LOBBY_ADDED, { lobbyAdded: formatted.lobbyId });
        this.logger.log(`Finished scraping and saving data for match ${matchId}`);
        return true;
    }

    private async saveMatchData(data: OsuMatchFormatted) {
        // Delete ongoing records from DB if more than 50 beatmaps
        if (data.maps.length > 50) {
            await this.prisma.$transaction(async (prisma) => {
                await prisma.lobbyPlayer.deleteMany({ where: { lobbyId: data.lobbyId } });
                await prisma.beatmap.deleteMany({ where: { lobbyId: data.lobbyId } });
                await prisma.lobby.deleteMany({ where: { lobbyId: data.lobbyId } })
            })
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

    @Cron(CronExpression.EVERY_DAY_AT_1AM)
    async cleanLobbies() {
        this.logger.log("Running lobbies housekeep")

        try {
            const sixMonthsAgo = new Date()
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);


            await this.prisma.$transaction(async (prisma) => {
                const deletedPlayers = await prisma.lobbyPlayer.deleteMany({
                    where: {
                        lobby: {
                            createdAt: { lt: sixMonthsAgo }
                        }
                    }
                });

                const deleteBeatmaps = await prisma.beatmap.deleteMany({
                    where: {
                        lobby: {
                            createdAt: { lt: sixMonthsAgo }
                        }
                    }
                });

                const deleteLobbies = await prisma.lobby.deleteMany({
                    where: {
                        createdAt: { lt: sixMonthsAgo }
                    }
                });

                this.logger.log(`Deleted ${deletedPlayers} lobbyplayers, ${deleteBeatmaps} beatmaps, and ${deleteLobbies} lobbies.`)
            });
        } catch (error) {
            this.logger.error("Failed to clean lobbies:", error)
        }
    }
}
