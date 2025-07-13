import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArtworkModule } from './endpoints/artwork/artwork.module';

@Module({
  imports: [ArtworkModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  constructor() {}
}
