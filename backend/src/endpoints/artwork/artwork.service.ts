import { Injectable } from '@nestjs/common';
import { GetArtworkInfoDto } from './dto/get-artwork-info.dto';
import { RagService } from 'src/services/rag.service';

@Injectable()
export class ArtworkService {
  constructor(private readonly ragService: RagService) {}

  async getArtworkInfo(queryObj: GetArtworkInfoDto) {
    return this.ragService.queryRag(queryObj);
  }
}
