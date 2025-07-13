import { Injectable } from '@nestjs/common';
import type { RagQueryResponse } from './rag.service';

@Injectable()
export class RagCacheService {
  private cache = new Map<string, RagQueryResponse>();

  get(query: string): RagQueryResponse | undefined {
    return this.cache.get(query.trim().toLowerCase());
  }

  set(query: string, response: RagQueryResponse): void {
    this.cache.set(query.trim().toLowerCase(), response);
  }
}
