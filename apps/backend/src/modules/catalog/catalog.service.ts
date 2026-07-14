import { Inject, Injectable } from '@nestjs/common';
import { REDIS, type RedisClient } from '../../infra/redis.module';
import { PrismaService } from '../../infra/prisma.module';

const CACHE_TTL_SEC = 300;

/**
 * Read-mostly catalogue (materials, patterns) with a Redis cache in front.
 * Admin mutations bust the cache.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: RedisClient,
  ) {}

  async listMaterials() {
    return this.cached('catalog:materials', () =>
      this.prisma.material.findMany({ where: { isActive: true }, orderBy: { pricePerGram: 'asc' } }),
    );
  }

  async listPatterns() {
    return this.cached('catalog:patterns', () =>
      this.prisma.pattern.findMany({ where: { isActive: true }, orderBy: { laborFactor: 'asc' } }),
    );
  }

  async bustCache(): Promise<void> {
    await this.redis.del('catalog:materials', 'catalog:patterns');
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = await this.redis.get(key);
    if (hit) return JSON.parse(hit) as T;
    const value = await load();
    await this.redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SEC);
    return value;
  }
}
