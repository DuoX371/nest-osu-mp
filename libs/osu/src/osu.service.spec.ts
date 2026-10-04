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
  let pace: jest.SpyInstance;

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
    pace = jest.spyOn(service as any, 'waitForRequestSlot').mockResolvedValue(undefined);
  });

  function unauthorized(): AxiosError {
    return Object.assign(new AxiosError('Unauthorized'), {
      response: { status: 401 },
    });
  }

  function setClients(count: number) {
    const clients = Array.from({ length: count }, (_, i) => ({ clientId: i + 1, nextRequestAt: 0 }));
    (service as any).clients = clients;
    return clients;
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

  it('paces requests from every scraper task through one queue', async () => {
    pace.mockRestore();
    jest.useFakeTimers();
    try {
      const [client] = setClients(1);
      await (service as any).waitForRequestSlot(client);
      const second = (service as any).waitForRequestSlot(client);
      let released = false;
      second.then(() => { released = true; });

      await jest.advanceTimersByTimeAsync(1499);
      expect(released).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await second;
      expect(released).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('scales to two clients while keeping each client at 40 requests per minute', async () => {
    pace.mockRestore();
    jest.useFakeTimers();
    try {
      const [first, second] = setClients(2);
      await (service as any).waitForRequestSlot(first);
      const secondRequest = (service as any).waitForRequestSlot(second);
      let secondReleased = false;
      secondRequest.then(() => { secondReleased = true; });
      await jest.advanceTimersByTimeAsync(749);
      expect(secondReleased).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await secondRequest;
      expect(secondReleased).toBe(true);

      const firstAgain = (service as any).waitForRequestSlot(first);
      let firstReleased = false;
      firstAgain.then(() => { firstReleased = true; });
      await jest.advanceTimersByTimeAsync(749);
      expect(firstReleased).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await firstAgain;
      expect(firstReleased).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('backs off for at least five minutes after a 429 and doubles on another 429', () => {
    const rateLimit = Object.assign(new AxiosError('Rate limited'), {
      response: { status: 429, headers: {}, data: { retry_after: 30 } },
    });
    (service as any).handleRateLimit(rateLimit);
    expect((service as any).cooldownUntil - Date.now()).toBeGreaterThanOrEqual(5 * 60_000 - 1000);
    (service as any).handleRateLimit(rateLimit);
    expect((service as any).cooldownUntil - Date.now()).toBeGreaterThanOrEqual(10 * 60_000 - 1000);
  });

  it('holds subsequent requests until the 429 cooldown ends', async () => {
    pace.mockRestore();
    jest.useFakeTimers();
    try {
      const [first, second] = setClients(2);
      const rateLimit = Object.assign(new AxiosError('Rate limited'), {
        response: { status: 429, headers: {}, data: { retry_after: 30 } },
      });
      (service as any).handleRateLimit(rateLimit);
      const request = (service as any).waitForRequestSlot(first);
      let released = false;
      request.then(() => { released = true; });

      await jest.advanceTimersByTimeAsync(5 * 60_000 - 1);
      expect(released).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await request;
      expect(released).toBe(true);

      const next = (service as any).waitForRequestSlot(second);
      let nextReleased = false;
      next.then(() => { nextReleased = true; });
      await jest.advanceTimersByTimeAsync(1499);
      expect(nextReleased).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await next;
      expect(nextReleased).toBe(true);
    } finally {
      jest.useRealTimers();
    }
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
