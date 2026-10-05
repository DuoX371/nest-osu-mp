import { LobbyService } from './lobby.service';

jest.mock('@prisma-client/prisma', () => ({ PrismaService: class {} }));

describe('LobbyService beatmap filtering', () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);
  const prisma = {
    lobby: { findMany, count },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  };
  const service = new LobbyService(prisma as any);

  beforeEach(() => {
    findMany.mockClear();
    count.mockClear();
  });

  it('requires every distinct beatmap ID in the same lobby', async () => {
    await service.findAll({ beatmapIds: [11, 22, 11] });

    const where = {
      AND: [
        { beatmaps: { some: { beatmapId: 11 } } },
        { beatmaps: { some: { beatmapId: 22 } } },
      ],
    };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where,
      include: expect.objectContaining({ beatmaps: true }),
    }));
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('does not query all lobbies for an empty beatmap ID array', async () => {
    await expect(service.findAll({ beatmapIds: [] })).resolves.toEqual({ lobbies: [], total: 0 });
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });

  it('rejects oversized beatmap filters before querying the database', async () => {
    await expect(service.findAll({ beatmapIds: Array.from({ length: 21 }, (_, i) => i + 1) }))
      .rejects.toThrow('Search supports at most 20 distinct beatmap IDs');
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });
});
