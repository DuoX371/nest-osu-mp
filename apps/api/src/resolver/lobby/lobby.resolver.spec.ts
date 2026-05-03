import { Test, TestingModule } from '@nestjs/testing';
import { LobbyResolver } from './lobby.resolver';

describe('LobbyResolver', () => {
  let resolver: LobbyResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LobbyResolver],
    }).compile();

    resolver = module.get<LobbyResolver>(LobbyResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
