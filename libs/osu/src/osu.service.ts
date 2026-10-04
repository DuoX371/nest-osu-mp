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
    nextRequestAt: number;
    nextTokenAttemptAt: number;
    tokenRequest: Promise<void> | null;
}

@Injectable()
export class OsuService implements OnModuleInit {
    private readonly logger = new Logger(OsuService.name);
    private readonly baseUrl = 'https://osu.ppy.sh/api/v2';
    private readonly tokenUrl = "https://osu.ppy.sh/oauth/token";

    private clients: OsuClient[] = [];
    private currentIndex = 0;
    private requestQueue: Promise<void> = Promise.resolve();
    private nextRequestAt = 0;
    private cooldownUntil = 0;
    private sharedLimitAfterRateLimit = false;
    private lastRateLimitAt = 0;
    private consecutiveRateLimits = 0;

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
                nextRequestAt: 0,
                nextTokenAttemptAt: 0,
                tokenRequest: null,
            }));

        const results = await Promise.allSettled(this.clients.map(client => this.getClientToken(client)));

        this.clients.forEach((c, i) => {
            const result = results[i];
            if (result.status === 'rejected') {
                this.logger.warn(
                    `Failed to get token for client ${c.clientId}: ${result.reason}`
                );
                c.nextTokenAttemptAt = Math.max(this.cooldownUntil, Date.now() + 5 * 60_000);
            }
        });

        if (this.clients.length === 0) {
            this.logger.warn('No osu! clients configured');
            return;
        }

        this.logger.log(
            `Token pool ready — ${this.getActiveClientCount()}/${this.clients.length} clients valid`,
        );
    }

    async getMatch(id: number): Promise<OsuMatch | null> {
        const client = await this.getNextClient();
        const fetchMatch = async () => {
            return this.getFromOsu<OsuMatch>(`/matches/${id}`, client);
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
        const data = await this.getFromOsu<{ matches: { id: number }[] }>(
            '/matches', client, { limit: 1, sort: 'id_desc' },
        );
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
        for (let tried = 0; tried < this.clients.length; tried++) {
            const client = this.clients[this.currentIndex];
            this.currentIndex = (this.currentIndex + 1) % this.clients.length;
            if (Date.now() < client.nextTokenAttemptAt) continue;

            try {
                await this.ensureToken(client);
                return client;
            } catch (error) {
                client.nextTokenAttemptAt = Math.max(this.cooldownUntil, Date.now() + 5 * 60_000);
                const message = error instanceof Error ? error.message : String(error);
                this.logger.warn(`Client ${client.clientId} unavailable; will retry later: ${message}`);
                if (isAxiosError(error) && error.response?.status === 429) throw error;
            }
        }
        throw new Error('No osu! API clients are available');
    }

    private getActiveClientCount(): number {
        const now = Date.now();
        return this.clients.filter(client => client.token && client.tokenExpiresAt && client.tokenExpiresAt.getTime() > now).length;
    }

    private async ensureToken(client: OsuClient) {
        if (!client.token || !client.tokenExpiresAt || new Date() >= client.tokenExpiresAt) {
            await this.getClientToken(client);
        }
    }

    private getClientToken(client: OsuClient): Promise<void> {
        if (client.tokenRequest) return client.tokenRequest;
        const request = this.fetchClientToken(client);
        client.tokenRequest = request;
        request.then(
            () => { client.tokenRequest = null; },
            () => { client.tokenRequest = null; },
        );
        return request;
    }

    private async fetchClientToken(client: OsuClient): Promise<void> {
        this.logger.log(`Getting osu! API token for client ${client.clientId}`);

        await this.waitForRequestSlot(client);
        let data: OsuToken;
        try {
            ({ data } = await firstValueFrom(
                this.http.post<OsuToken>(this.tokenUrl, {
                    client_id: client.clientId,
                    client_secret: client.clientSecret,
                    grant_type: 'client_credentials',
                    scope: 'public'
                })
            ));
        } catch (error) {
            this.handleRateLimit(error);
            throw error;
        }

        client.token = data.access_token;
        client.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
        client.nextTokenAttemptAt = 0;
    }

    private async getFromOsu<T>(path: string, client: OsuClient, params?: Record<string, unknown>): Promise<T> {
        await this.waitForRequestSlot(client);
        try {
            const { data } = await firstValueFrom(this.http.get<T>(`${this.baseUrl}${path}`, {
                params,
                headers: { Authorization: `Bearer ${client.token}` },
            }));
            return data;
        } catch (error) {
            this.handleRateLimit(error);
            throw error;
        }
    }

    private async waitForRequestSlot(client: OsuClient): Promise<void> {
        const turn = this.requestQueue.then(async () => {
            // Each client gets 40 requests/minute; spread their starts across one queue.
            const activeClients = Math.max(1, this.getActiveClientCount());
            const sharedInterval = this.sharedLimitAfterRateLimit ? 1500 : 1500 / activeClients;
            while (true) {
                const delay = Math.max(this.nextRequestAt, client.nextRequestAt, this.cooldownUntil) - Date.now();
                if (delay <= 0) break;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            const now = Date.now();
            this.nextRequestAt = now + sharedInterval;
            client.nextRequestAt = now + 1500;
        });
        this.requestQueue = turn.catch(() => undefined);
        await turn;
    }

    private handleRateLimit(error: unknown): void {
        if (!isAxiosError(error) || error.response?.status !== 429) return;

        const now = Date.now();
        this.consecutiveRateLimits = now - this.lastRateLimitAt < 2 * 60 * 60_000
            ? Math.min(this.consecutiveRateLimits + 1, 5)
            : 1;
        this.lastRateLimitAt = now;
        this.sharedLimitAfterRateLimit = true;
        const backoff = Math.min(60 * 60_000, 5 * 60_000 * 2 ** (this.consecutiveRateLimits - 1));
        const retryAfter = Number(error.response.headers?.['retry-after'] ?? error.response.data?.retry_after);
        const retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0;
        const delay = Math.max(backoff, retryAfterMs);
        this.cooldownUntil = Math.max(this.cooldownUntil, now + delay);
        this.logger.warn(`osu! returned 429; pausing all osu! requests for at least ${Math.ceil(delay / 60_000)} minutes`);
    }
}
