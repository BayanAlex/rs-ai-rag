import { ApiProperty } from '@nestjs/swagger';

export class GetArtworkInfoDto {
  @ApiProperty({
    description: 'The query string for artwork info',
    example: 'Find artworks with floral motifs or nature themes',
  })
  query: string;
}
