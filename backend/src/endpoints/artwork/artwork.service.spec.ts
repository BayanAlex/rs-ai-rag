import { Test, TestingModule } from '@nestjs/testing';
import { ArtworkService } from './artwork.service';

describe('ArtworkService', () => {
  let service: ArtworkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ArtworkService],
    }).compile();

    service = module.get<ArtworkService>(ArtworkService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
