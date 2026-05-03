import { Test, TestingModule } from '@nestjs/testing';
import { OsuService } from './osu.service';

describe('OsuService', () => {
  let service: OsuService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OsuService],
    }).compile();

    service = module.get<OsuService>(OsuService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
