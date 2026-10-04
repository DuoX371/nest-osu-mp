import { OsuMatch, OsuMatchFormatted, OsuToken } from './osu.types';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { isAxiosError } from 'axios';

interface OsuClient {
    clientId: number;
    clientSecret: string;
    token: string | null;
    tokenExpiresAt: Date | null;
}

@Injectable()
export class OsuService implements OnModuleInit {
    private readonly logger = new Logger(OsuService.name);
    private readonly baseUrl = 'https://osu.ppy.sh/api/v2';
    private readonly tokenUrl = "https://osu.ppy.sh/oauth/token";

    private clients: OsuClient[] = [];
    private currentIndex = 0;

    constructor(
        private readonly http: HttpService,
        private readonly config: ConfigService
    ) { }

    async onModuleInit() {
        const config: {
            clientId: number | null;
            clientSecret: string | null;
        }[] = [
                {
                    clientId: this.config.getOrThrow('OSU_CLIENT_ID'),
                    clientSecret: this.config.getOrThrow('OSU_CLIENT_SECRET'),
                },
                {
                    clientId: this.config.get('OSU_CLIENT_ID_2') || null,
                    clientSecret: this.config.get('OSU_CLIENT_SECRET_2') || null,
                }
            ];

        this.clients = config
            .filter((c) => c.clientId && c.clientSecret)
            .map((c) => ({
                clientId: c.clientId as number,
                clientSecret: c.clientSecret as string,
                token: null,
                tokenExpiresAt: null,
            }));

        const results = await Promise.allSettled(this.clients.map(client => this.getClientToken(client)));

        this.clients = this.clients.filter((c, i) => {
            const result = results[i];
            if (result.status === 'rejected') {
                this.logger.warn(
                    `Failed to get token for client ${c.clientId}: ${result.reason}`
                );
                return false;
            }
            return true;
        })

        if (this.clients.length === 0) {
            this.logger.warn('No osu! clients configured');
            return;
        }

        this.logger.log(
            `Token pool ready — ${this.clients.length}/${config.length} clients valid`,
        );
    }

    async getMatch(id: number): Promise<OsuMatch | null> {
        const client = await this.getNextClient();
        const fetchMatch = async () => {
            const { data } = await firstValueFrom(this.http.get<OsuMatch>(`${this.baseUrl}/matches/${id}`, {
                headers: {
                    Authorization: `Bearer ${client.token}`
                }
            }));
            return data;
        };

        try {
            return await fetchMatch();
        } catch (error) {
            if (!isAxiosError(error) || error.response?.status !== 401) {
                throw error;
            }

            this.logger.warn(`osu! rejected the token for client ${client.clientId}; refreshing it`);
            await this.getClientToken(client);
            try {
                return await fetchMatch();
            } catch (retryError) {
                if (!isAxiosError(retryError) || retryError.response?.status !== 401) {
                    throw retryError;
                }

                // Confirm this token works before treating a 401 as specific to this match.
                await this.getLatestMatchIdForClient(client);
                this.logger.warn(`Match ${id} is inaccessible with a valid osu! token; skipping it`);
                return null;
            }
        }
    }

    async getLatestMatchId(): Promise<number> {
        const client = await this.getNextClient();
        try {
            return await this.getLatestMatchIdForClient(client);
        } catch (error) {
            if (!isAxiosError(error) || error.response?.status !== 401) {
                throw error;
            }
            await this.getClientToken(client);
            return this.getLatestMatchIdForClient(client);
        }
    }

    private async getLatestMatchIdForClient(client: OsuClient): Promise<number> {
        const { data } = await firstValueFrom(this.http.get<{ matches: { id: number }[] }>(
            `${this.baseUrl}/matches`, {
                params: { limit: 1, sort: 'id_desc' },
                headers: { Authorization: `Bearer ${client.token}` },
            },
        ));
        const id = data.matches?.[0]?.id;
        if (!Number.isSafeInteger(id)) {
            throw new Error('osu! returned no latest match ID');
        }
        return id;
    }

    /** 
     * Helper methods
    */

    extractDetails(match: OsuMatch): OsuMatchFormatted {
        return {
            lobbyId: match.match.id,
            createdAt: new Date(match.match.start_time),
            status: match.match.end_time ? 'completed' : 'ongoing',
            title: match.match.name,
            players: this.extractPlayers(match),
            maps: this.extractMaps(match)
        }
    }

    extractPlayers(match: OsuMatch): { playerId: number; username: string }[] {
        return match.users.map(user => ({
            playerId: user.id,
            username: user.username
        }));
    }

    extractMaps(match: OsuMatch): { beatmapId: number; beatmapsetId: number }[] {
        return match.events
            .filter(e => e.detail.type === 'other' && e.game)
            .map(e => ({
                beatmapId: e.game!.beatmap_id,
                beatmapsetId: e.game!.beatmap?.beatmapset_id ?? 0
            }));
    }

    private async getNextClient(): Promise<OsuClient> {
        if (!this.clients.length) {
            await this.onModuleInit();
        }
        if (!this.clients.length) {
            throw new Error('No osu! API clients are available');
        }
        const client = this.clients[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.clients.length;
        await this.ensureToken(client);
        return client;
    }

    private async ensureToken(client: OsuClient) {
        if (!client.token || !client.tokenExpiresAt || new Date() >= client.tokenExpiresAt) {
            await this.getClientToken(client);
        }
    }

    private async getClientToken(client: OsuClient) {
        this.logger.log(`Getting osu! API token for client ${client.clientId}`);

        const { data } = await firstValueFrom(
            this.http.post<OsuToken>(this.tokenUrl, {
                client_id: client.clientId,
                client_secret: client.clientSecret,
                grant_type: 'client_credentials',
                scope: 'public'
            })
        );

        client.token = data.access_token;
        client.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    }
}
