import { Controller, Post, Body } from '@nestjs/common';
import { ArtworkService } from './artwork.service';
import { GetArtworkInfoDto } from './dto/get-artwork-info.dto';

@Controller('artwork')
export class ArtworkController {
  constructor(private readonly artworkService: ArtworkService) {}

  @Post()
  getArtworkInfo(@Body() getArtworkInfoDto: GetArtworkInfoDto) {
    return this.artworkService.getArtworkInfo(getArtworkInfoDto);
  }
}
