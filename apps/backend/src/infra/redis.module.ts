import { Global, Inject, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { CONFIG, type AppConfig } from '../config/config';

export const REDIS = 'REDIS_CLIENT' as const;

export type RedisClient = Redis;

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [CONFIG],
      useFactory: (config: AppConfig): Redis =>
        new Redis(config.REDIS_URL, { maxRetriesPerRequest: null }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}

export const InjectRedis = (): ParameterDecorator => Inject(REDIS);
