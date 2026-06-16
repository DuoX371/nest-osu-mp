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
            const latest = await this.prisma.lobby.findFirst({
                orderBy: { lobbyId: "desc" },
                select: { lobbyId: true },
            });

            const startId = latest ? latest.lobbyId + 1 : 1;
            this.logger.log(`New scrape from lobbyId: ${startId}`);

            let currentId = startId;
            let consecutiveFail = 0;
            const MAX_CONSECUTIVE_FAILS = 3;
            while (consecutiveFail < MAX_CONSECUTIVE_FAILS) {
                const sucess = await this.scrapeMatch(currentId).catch(_e => {
                    //this.logger.error(e)
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

            for (const { lobbyId } of ongoingLobbies) {
                await this.scrapeMatch(lobbyId);
            }
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
            this.logger.log(`Skipping match: ${matchId}`);
            return true;
        }
        const formatted = this.osuService.extractDetails(match);

        await this.saveMatchData(formatted);
        await this.pubSub.publish(LOBBY_ADDED, { lobbyAdded: formatted.lobbyId });
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

    // @Cron(CronExpression.EVERY_DAY_AT_1AM)
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
