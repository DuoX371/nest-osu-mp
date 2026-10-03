import { AxiosError } from 'axios';
import { ScraperService } from './scraper.service';

jest.mock('@prisma-client/prisma', () => ({ PrismaService: class {} }));
jest.mock('apps/api/src/resolver/lobby/lobby.resolver', () => ({ LOBBY_ADDED: 'lobbyAdded' }), { virtual: true });
jest.mock('p-limit', () => ({ __esModule: true, default: () => (task: () => Promise<unknown>) => task() }));

describe('ScraperService discovery cursor', () => {
  let nextLobbyId: number;
  let service: ScraperService;
  let scrapeMatch: jest.SpyInstance;
  let updateCursor: jest.Mock;

  beforeEach(() => {
    nextLobbyId = 100;
    updateCursor = jest.fn().mockImplementation(async ({ data }) => {
      nextLobbyId = data.nextLobbyId;
    });
    const prisma = {
      scrapeCursor: {
        findUniqueOrThrow: jest.fn().mockImplementation(async () => ({ nextLobbyId })),
        update: updateCursor,
      },
    };
    service = new ScraperService({} as any, prisma as any, {} as any);
    scrapeMatch = jest.spyOn(service, 'scrapeMatch');
  });

  function missingMatch(): AxiosError {
    return Object.assign(new AxiosError('Match not found'), {
      response: { status: 404 },
    });
  }

  it('persists each missing ID and resumes at the next ID on the following run', async () => {
    scrapeMatch.mockImplementation(async () => { throw missingMatch(); });

    await service.fetchNewMatches();
    expect(scrapeMatch.mock.calls.map(([id]) => id)).toEqual([100, 101, 102]);
    expect(nextLobbyId).toBe(103);

    scrapeMatch.mockClear();
    await service.fetchNewMatches();
    expect(scrapeMatch.mock.calls.map(([id]) => id)).toEqual([103, 104, 105]);
    expect(nextLobbyId).toBe(106);
  });

  it.each([
    ['a temporary save failure', new Error('Temporary failure')],
    ['an unresolved 401', Object.assign(new AxiosError('Unauthorized'), { response: { status: 401 } })],
  ])('does not advance after %s', async (_reason, error) => {
    scrapeMatch.mockRejectedValue(error);

    await service.fetchNewMatches();
    expect(scrapeMatch).toHaveBeenCalledTimes(1);
    expect(scrapeMatch).toHaveBeenCalledWith(100);
    expect(updateCursor).not.toHaveBeenCalled();

    await service.fetchNewMatches();
    expect(scrapeMatch).toHaveBeenLastCalledWith(100);
  });

  it('resets the consecutive missing count after a successful match', async () => {
    scrapeMatch.mockImplementation(async (id: number) => {
      if (id === 101) return true;
      throw missingMatch();
    });

    await service.fetchNewMatches();
    expect(scrapeMatch.mock.calls.map(([id]) => id)).toEqual([100, 101, 102, 103, 104]);
    expect(nextLobbyId).toBe(105);
  });

  it('sets the beatmapset ID only when creating a beatmap row', async () => {
    const beatmapUpsert = jest.fn();
    const transaction = {
      lobby: { upsert: jest.fn() },
      beatmap: { upsert: beatmapUpsert },
    };
    const prisma = { $transaction: (work: (tx: typeof transaction) => Promise<unknown>) => work(transaction) };
    const formatted = {
      lobbyId: 100,
      title: 'Match',
      createdAt: new Date(),
      status: 'completed',
      players: [],
      maps: [{ beatmapId: 200, beatmapsetId: 300 }],
    };
    const osu = { getMatch: jest.fn().mockResolvedValue({}), extractDetails: () => formatted };
    const pubSub = { publish: jest.fn() };
    const scraper = new ScraperService(osu as any, prisma as any, pubSub as any);

    await scraper.scrapeMatch(100);

    expect(beatmapUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { lobbyId_beatmapId: { lobbyId: 100, beatmapId: 200 } },
      create: { beatmapId: 200, beatmapSetId: 300, lobbyId: 100 },
      update: {},
    }));
  });
});
