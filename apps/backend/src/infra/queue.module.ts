import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { QUEUES } from '@grillz/shared-types';
import { CONFIG, type AppConfig } from '../config/config';
import { isMemoryMode } from './redis.module';
import { BullJobQueue, MemoryJobQueue, type JobQueue } from './job-queue';

export const SCAN_QUEUE = 'SCAN_QUEUE' as const;
export const RENDER_QUEUE = 'RENDER_QUEUE' as const;
export const NOTIFY_QUEUE = 'NOTIFY_QUEUE' as const;

function makeQueue(name: string, config: AppConfig): JobQueue {
  return isMemoryMode(config) ? new MemoryJobQueue(name) : new BullJobQueue(name, config.REDIS_URL);
}

@Global()
@Module({
  providers: [
    {
      provide: SCAN_QUEUE,
      inject: [CONFIG],
      useFactory: (config: AppConfig) => makeQueue(QUEUES.scanPipeline, config),
    },
    {
      provide: RENDER_QUEUE,
      inject: [CONFIG],
      useFactory: (config: AppConfig) => makeQueue(QUEUES.rendering, config),
    },
    {
      provide: NOTIFY_QUEUE,
      inject: [CONFIG],
      useFactory: (config: AppConfig) => makeQueue(QUEUES.notifications, config),
    },
  ],
  exports: [SCAN_QUEUE, RENDER_QUEUE, NOTIFY_QUEUE],
})
export class QueueModule implements OnModuleDestroy {
  constructor(
    @Inject(SCAN_QUEUE) private readonly scanQueue: JobQueue,
    @Inject(RENDER_QUEUE) private readonly renderQueue: JobQueue,
    @Inject(NOTIFY_QUEUE) private readonly notifyQueue: JobQueue,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.scanQueue.close(), this.renderQueue.close(), this.notifyQueue.close()]);
  }
}
