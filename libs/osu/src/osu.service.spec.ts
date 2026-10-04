import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { of, throwError } from 'rxjs';
import { OsuService } from './osu.service';
import { OsuMatch, OsuMatchEventTypes } from './osu.types';

describe('OsuService token recovery', () => {
  const match = { match: { id: 123 } } as OsuMatch;
  let get: jest.Mock;
  let post: jest.Mock;
  let service: OsuService;

  beforeEach(() => {
    get = jest.fn();
    post = jest.fn()
      .mockReturnValueOnce(of({ data: { access_token: 'first-token', expires_in: 3600 } }))
      .mockReturnValueOnce(of({ data: { access_token: 'refreshed-token', expires_in: 3600 } }));
    const config = {
      getOrThrow: (key: string) => key === 'OSU_CLIENT_ID' ? 1 : 'secret',
      get: () => null,
    };
    service = new OsuService({ get, post } as unknown as HttpService, config as unknown as ConfigService);
  });

  function unauthorized(): AxiosError {
    return Object.assign(new AxiosError('Unauthorized'), {
      response: { status: 401 },
    });
  }

  it('refreshes a rejected token and retries the match once', async () => {
    get.mockReturnValueOnce(throwError(() => unauthorized()))
      .mockReturnValueOnce(of({ data: match }));

    await expect(service.getMatch(123)).resolves.toBe(match);
    expect(post).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[0][1].headers.Authorization).toBe('Bearer first-token');
    expect(get.mock.calls[1][1].headers.Authorization).toBe('Bearer refreshed-token');
  });

  it('propagates a second 401 instead of treating the match as missing', async () => {
    get.mockReturnValue(throwError(() => unauthorized()));

    await expect(service.getMatch(123)).rejects.toMatchObject({ response: { status: 401 } });
    expect(get).toHaveBeenCalledTimes(3);
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('skips a match only when the refreshed token can fetch the match list', async () => {
    get.mockReturnValueOnce(throwError(() => unauthorized()))
      .mockReturnValueOnce(throwError(() => unauthorized()))
      .mockReturnValueOnce(of({ data: { matches: [{ id: 200 }] } }));

    await expect(service.getMatch(123)).resolves.toBeNull();
    expect(get.mock.calls[2][0]).toBe('https://osu.ppy.sh/api/v2/matches');
    expect(get.mock.calls[2][1].headers.Authorization).toBe('Bearer refreshed-token');
  });

  it('gets the latest match ID from the public match list', async () => {
    get.mockReturnValue(of({ data: { matches: [{ id: 200 }] } }));
    await expect(service.getLatestMatchId()).resolves.toBe(200);
    expect(get).toHaveBeenCalledWith('https://osu.ppy.sh/api/v2/matches', expect.objectContaining({
      params: { limit: 1, sort: 'id_desc' },
    }));
  });

  it('does not refresh the token for a rate limit response', async () => {
    const rateLimit = Object.assign(new AxiosError('Rate limited'), {
      response: { status: 429 },
    });
    get.mockReturnValue(throwError(() => rateLimit));

    await expect(service.getMatch(123)).rejects.toBe(rateLimit);
    expect(get).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('extracts the beatmapset ID from the beatmap, not the match game', () => {
    const matchWithGame = {
      events: [{
        detail: { type: OsuMatchEventTypes.Other },
        game: {
          id: 900,
          beatmap_id: 200,
          beatmap: { id: 200, beatmapset_id: 300 },
        },
      }],
    } as OsuMatch;

    expect(service.extractMaps(matchWithGame)).toEqual([
      { beatmapId: 200, beatmapsetId: 300 },
    ]);
  });

  it('keeps the beatmap ID when osu! omits the beatmap object', () => {
    const matchWithMissingBeatmap = {
      events: [{
        detail: { type: OsuMatchEventTypes.Other },
        game: { id: 900, beatmap_id: 200 },
      }],
    } as OsuMatch;

    expect(service.extractMaps(matchWithMissingBeatmap)).toEqual([
      { beatmapId: 200, beatmapsetId: 0 },
    ]);
  });
});
