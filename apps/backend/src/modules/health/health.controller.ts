import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma.module';
import { REDIS, type RedisClient } from '../../infra/redis.module';
import { Public } from '../../common/decorators';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: RedisClient,
  ) {}

  /** Liveness: process is up. */
  @Public()
  @Get()
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: dependencies reachable. */
  @Public()
  @Get('ready')
  async ready(): Promise<{ status: 'ok'; postgres: boolean; redis: boolean }> {
    const [pg, rd] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.redis.ping().then(() => true).catch(() => false),
    ]);
    if (!pg || !rd) {
      throw new ServiceUnavailableException({ status: 'degraded', postgres: pg, redis: rd });
    }
    return { status: 'ok', postgres: pg, redis: rd };
  }
}
