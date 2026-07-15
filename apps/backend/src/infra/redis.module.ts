import { Global, Inject, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { CONFIG, type AppConfig } from '../config/config';
import { MemoryKv, type KvClient } from './kv';

export const REDIS = 'REDIS_CLIENT' as const;

export type RedisClient = KvClient;

export function isMemoryMode(config: AppConfig): boolean {
  return config.REDIS_URL === 'memory';
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [CONFIG],
      useFactory: (config: AppConfig): KvClient =>
        isMemoryMode(config)
          ? new MemoryKv()
          : new Redis(config.REDIS_URL, { maxRetriesPerRequest: null }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}

export const InjectRedis = (): ParameterDecorator => Inject(REDIS);
