import { Module } from '@nestjs/common';
import { ArtworkService } from './artwork.service';
import { ArtworkController } from './artwork.controller';
import { RagService } from 'src/services/rag.service';
import { ConfigModule } from '@nestjs/config/dist/config.module';
import { RagCacheService } from 'src/services/rag-cache.service';

@Module({
  imports: [ConfigModule.forRoot()],
  controllers: [ArtworkController],
  providers: [ArtworkService, RagService, RagCacheService],
})
export class ArtworkModule {}
