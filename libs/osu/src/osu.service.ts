import { OsuMatch, OsuMatchFormatted, OsuToken } from './osu.types';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { catchError, firstValueFrom, of } from 'rxjs';

@Injectable()
export class OsuService {
    private readonly logger = new Logger(OsuService.name);
    private readonly baseUrl = 'https://osu.ppy.sh/api/v2';
    private readonly tokenUrl = "https://osu.ppy.sh/oauth/token";

    private token: string | null = null;
    private tokenExpiresAt: Date | null = null;
    private refreshToken: string | null = null;

    constructor(
        private readonly http: HttpService,
        private readonly config: ConfigService
    ) { }

    async getMatch(id: number): Promise<OsuMatch | null> {
        await this.ensureToken();

        const { data } = await firstValueFrom(
            this.http.get<OsuMatch>(`${this.baseUrl}/matches/${id}`, {
                headers: {
                    Authorization: `Bearer ${this.token}`
                }
            }).pipe(
                catchError((err) => {
                    if (err.status === 401) {
                        // expired or unaothrized
                        return of({ data: null });
                    }
                    throw err;
                })
            )
        );

        return data;
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
                beatmapsetId: e.game!.id
            }));
    }

    private async ensureToken() {
        if (!this.token || !this.tokenExpiresAt || new Date() >= this.tokenExpiresAt) {
            await this.getToken();
        }
    }

    private async getToken() {
        this.logger.log('Getting osu! API token');

        const { data } = await firstValueFrom(
            this.http.post<OsuToken>(this.tokenUrl, {
                client_id: this.config.getOrThrow('OSU_CLIENT_ID'),
                client_secret: this.config.getOrThrow('OSU_CLIENT_SECRET'),
                grant_type: 'client_credentials',
                scope: 'public'
            })
        );

        this.token = data.access_token;
        this.refreshToken = data.refresh_token;
        this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

        this.logger.log('Successfully obtained osu! API token. Expires at: ' + this.tokenExpiresAt.toISOString());
    }
}
