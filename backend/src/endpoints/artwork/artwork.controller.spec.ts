import { Test, TestingModule } from '@nestjs/testing';
import { ArtworkController } from './artwork.controller';
import { ArtworkService } from './artwork.service';

describe('ArtworkController', () => {
  let controller: ArtworkController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArtworkController],
      providers: [ArtworkService],
    }).compile();

    controller = module.get<ArtworkController>(ArtworkController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
